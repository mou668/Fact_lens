"""Analysis endpoints.

The real pipeline lives in ``ml/predict.py`` (owner: ML teammate).  The
response keeps every field from the original contract and only *adds* the
explainability fields (severity, tactics, attention, counterfactuals).
"""
from __future__ import annotations

import json
import http.client
import ipaddress
import logging
import os
import re
import socket
import ssl
import sys
import threading
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zipfile import BadZipFile

from docx.opc.exceptions import PackageNotFoundError
from docx.oxml.exceptions import InvalidXmlError
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response
from lxml.etree import XMLSyntaxError
from PIL import Image, UnidentifiedImageError
import pytesseract
import tldextract
import pytesseract
from pypdf.errors import PdfReadError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Analysis, Feedback, User
from ..schemas import AnalyzeIn, AnalyzeUrlIn, FactCheckIn, FeedbackIn
from ..config import settings

logger = logging.getLogger("factlens.analysis")

router = APIRouter(prefix="/api", tags=["analysis"])
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ARTICLE_BYTES = 1024 * 1024
MAX_ANALYSIS_CHARS = 20_000


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_wrap(text: str, width: int = 105) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text or "").splitlines() or [""]:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        line = ""
        for word in words:
            candidate = word if not line else f"{line} {word}"
            if len(candidate) <= width:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def _make_report_pdf(result: dict) -> bytes:
    models = result.get("models") or []
    words = result.get("words") or []
    explanation = result.get("explanation") or {}
    explanation_text = explanation if isinstance(explanation, str) else explanation.get("summary") or json.dumps(explanation, ensure_ascii=True)

    lines = [
        "FactLens Analysis Report",
        "",
        f"Analysis ID: {result.get('id', '')}",
        f"Verdict: {result.get('label', 'UNKNOWN')}",
        f"Confidence: {float(result.get('confidence', 0)):.1%}",
        "",
        "Per-model results:",
    ]
    for model in models:
        lines.append(f"- {model.get('name', 'Model')}: {model.get('label', '')} ({float(model.get('confidence', 0)):.1%})")
    lines.extend(["", "Top words:"])
    lines.extend([f"- {w.get('word', '')}: {float(w.get('score', 0)):.4f}" for w in words[:20]])
    lines.extend(["", "Explanation:"])
    lines.extend(_pdf_wrap(str(explanation_text), 105))

    # Split into printable A4-like pages.
    chunks = [lines[i:i + 42] for i in range(0, len(lines), 42)] or [[]]
    objects: list[bytes | None] = [None] * 4
    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[2] = b"<< /Type /Pages /Kids [] /Count 0 >>"
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    page_refs: list[str] = []

    for chunk in chunks:
        commands = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"]
        for index, line in enumerate(chunk):
            safe = _pdf_escape(line.encode("latin-1", "replace").decode("latin-1"))
            commands.append(f"({safe}) Tj" if index == 0 else "0 -14 Td (" + safe + ") Tj")
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", "replace")
        content_id = len(objects)
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"\nendstream")
        page_id = len(objects)
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode("ascii"))
        page_refs.append(f"{page_id} 0 R")

    objects[2] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>".encode("ascii")

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0] * len(objects)
    for index in range(1, len(objects)):
        offsets[index] = len(output)
        output.extend(f"{index} 0 obj\n".encode("ascii") + objects[index] + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects)}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for index in range(1, len(objects)):
        output.extend(f"{offsets[index]:010d} 00000 n \n".encode("ascii"))
    output.extend(f"trailer\n<< /Size {len(objects)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(output)

# Make the repo-root ``ml`` package importable both locally and in Docker.
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

SAMPLE = {
    "id": 17, "label": "FAKE", "confidence": 0.937,
    "models": [{"name": "BERT", "label": "FAKE", "confidence": 0.95}],
    "words": [{"word": "miracle", "score": 0.842}],
    "shap": [{"feature": "Exclamation Count", "value": 1.283}],
}


def _ml_predict(text: str) -> dict:
    """Call the trained pipeline, degrading gracefully instead of 500-ing."""
    try:
        from ml.predict import predict as ml_predict

        return ml_predict(text)
    except Exception as exc:  # noqa: BLE001 - the API must stay available
        logger.exception("ML pipeline failed, serving heuristic fallback: %s", exc)
        from ml.factlens_ml.registry import get_registry

        payload = get_registry()._fallback(text)  # noqa: SLF001 - explicit fallback path
        payload.setdefault("engine", {})["note"] = f"ML error: {type(exc).__name__}"
        return payload


def _warmup() -> None:
    """Load torch/transformers and the artifacts in the background at boot."""
    try:
        from ml.predict import warmup

        logger.info("ML warmup: %s", warmup())
    except Exception:  # noqa: BLE001 - first request will retry and fall back
        logger.exception("ML warmup failed")


if os.getenv("FACTLENS_WARMUP", "1") != "0":
    threading.Thread(target=_warmup, name="ml-warmup", daemon=True).start()


def run_model(text: str) -> dict:
    """Return the analysis payload for ``text`` (no ``id`` field)."""
    return _ml_predict(text)


def _save_analysis(text: str, user: User, db: Session, metadata: dict | None = None) -> dict:
    out = run_model(text)
    out["low_confidence"] = out.get("confidence", 1.0) < 0.65
    if metadata:
        out.update(metadata)
    row = Analysis(user_id=user.id, text=text, label=out["label"],
                   confidence=out["confidence"], result=out)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, **out}


class _ArticleTextParser(HTMLParser):
    _SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP_TAGS:
            self.skip_depth += 1
        elif tag in {"p", "br", "div", "article", "section", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1
        elif tag in {"p", "div", "article", "section", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host: str, port: int, address: str, timeout: int) -> None:
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self.address = address

    def connect(self) -> None:
        raw_socket = socket.create_connection((self.address, self.port), self.timeout)
        self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)


def _fetch_article(url: str) -> tuple[str, str, bool]:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").encode("idna").decode("ascii")
        port = parsed.port
    except (UnicodeError, ValueError) as exc:
        raise HTTPException(422, "Enter a valid public article URL.") from exc

    if parsed.scheme not in {"http", "https"} or not host or parsed.username or parsed.password:
        raise HTTPException(422, "Only public HTTP or HTTPS article URLs are supported.")
    if port not in (None, 80 if parsed.scheme == "http" else 443):
        raise HTTPException(422, "Non-standard URL ports are not supported.")
    port = port or (80 if parsed.scheme == "http" else 443)

    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise HTTPException(422, "The article host could not be reached.") from exc
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise HTTPException(422, "Private and non-public article hosts are not allowed.")

    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    host_header = f"[{host}]" if ":" in host else host
    headers = {
        "Host": host_header,
        "User-Agent": "FactLens/1.0",
        "Accept": "text/html,text/plain",
        "Accept-Encoding": "identity",
    }
    try:
        for address in sorted(addresses):
            connection = (
                _PinnedHTTPSConnection(host, port, address, timeout=8)
                if parsed.scheme == "https"
                else http.client.HTTPConnection(address, port, timeout=8)
            )
            try:
                connection.request("GET", path, headers=headers)
                response = connection.getresponse()
                if response.status in {301, 302, 303, 307, 308}:
                    raise HTTPException(422, "Redirecting article URLs are not supported.")
                if response.status != 200:
                    raise HTTPException(422, f"The article server returned HTTP {response.status}.")
                content_type = response.getheader("Content-Type", "").lower()
                if not (content_type.startswith("text/html") or content_type.startswith("text/plain")):
                    raise HTTPException(422, "The URL must point to an HTML or plain-text article.")
                raw = response.read(MAX_ARTICLE_BYTES + 1)
                if len(raw) > MAX_ARTICLE_BYTES:
                    raise HTTPException(413, "The article page is too large to analyze.")
                charset_match = re.search(r"charset=([A-Za-z0-9._-]+)", content_type)
                charset = charset_match.group(1) if charset_match else "utf-8"
                try:
                    page = raw.decode(charset, errors="replace")
                except LookupError as exc:
                    raise HTTPException(422, "The article uses an unsupported text encoding.") from exc
                if content_type.startswith("text/html"):
                    parser = _ArticleTextParser()
                    parser.feed(page)
                    page = "".join(parser.parts)
                text = re.sub(r"\s+", " ", page).strip()
                if len(text) < 10:
                    raise HTTPException(422, "No readable article text was found at this URL.")
                if len(text) > MAX_ANALYSIS_CHARS:
                    raise HTTPException(413, "The article text exceeds the 20,000-character analysis limit.")
                return text, host, parsed.scheme == "https"
            finally:
                connection.close()
    except HTTPException:
        raise
    except (OSError, http.client.HTTPException, UnicodeError) as exc:
        raise HTTPException(422, "The article could not be fetched or decoded.") from exc
    raise HTTPException(422, "The article host could not be reached.")


@router.post("/extract-image-text")
def extract_image_text(file: UploadFile, user: User = Depends(get_current_user)):
    filename = (file.filename or "").lower()
    if not filename.endswith((".png", ".jpg", ".jpeg")):
        raise HTTPException(415, "Choose a PNG or JPG image.")
    if file.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(415, "Choose a PNG or JPG image.")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Images must be 5 MB or smaller.")
    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
            if image.format not in {"PNG", "JPEG"}:
                raise HTTPException(415, "Choose a PNG or JPG image.")
        with Image.open(BytesIO(data)) as image:
            rgb = image.convert("RGB")
            try:
                text = pytesseract.image_to_string(rgb)
            except pytesseract.TesseractNotFoundError as exc:
                raise HTTPException(503, "OCR service is not available on the server.") from exc
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(422, "The image could not be read.") from exc
    text = re.sub(r"\s+", " ", text).strip()
    text = text[:MAX_ANALYSIS_CHARS]
    if not text:
        raise HTTPException(422, "No readable text was found in the image.")
    return {"text": text}


def _extract_url_metadata(url: str) -> tuple[str, str, bool]:
    """Fetch a URL and extract the article body, title, and domain.

    Returns (text, domain, is_https).
    """
    import trafilatura

    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded is None:
            raise HTTPException(422, "Could not download the URL.")
        text = trafilatura.extract(downloaded)
        if not text or len(text.strip()) < 10:
            raise HTTPException(422, "No readable article text was found at this URL.")
        if len(text) > MAX_ANALYSIS_CHARS:
            raise HTTPException(413, "The article text exceeds the 20,000-character analysis limit.")
        # Extract domain info
        ext = tldextract.extract(url)
        domain = f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else url
        is_https = url.startswith("https://")
        # Determine a simple credibility badge
        trusted_prefixes = ("bbc", "reuters", "ap ", "npr", " nyt", "the guardian", "bloomberg")
        domain_lower = domain.lower().replace("www.", "")
        is_trusted = any(domain_lower.startswith(p) for p in trusted_prefixes)
        return text, domain, is_https, is_trusted
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - the API must stay available
        raise HTTPException(422, f"The article could not be fetched or decoded: {exc}") from exc


def _fetch_evidence(claims: list[str], user: User | None = None) -> list[dict]:
    """Phase 2: Fetch live evidence for claims from Fact Check and News APIs.

    Returns a list of evidence dicts: [{source, title, link, rating_or_stance}, ...].
    """
    evidence: list[dict] = []

    # --- Google Fact Check Tools API ---
    if settings.GOOGLE_FACT_CHECK_API_KEY:
        import urllib.parse
        for claim in claims[:5]:  # limit to 5 claims, 5 reviews each
            try:
                query = urllib.parse.urlencode({"query": claim, "languageCode": "en", "key": settings.GOOGLE_FACT_CHECK_API_KEY})
                request = urllib.request.Request(
                    f"https://factchecktools.googleapis.com/v1alpha1/claims:search?{query}",
                    headers={"Accept": "application/json", "User-Agent": "FactLens/1.0"},
                )
                with urllib.request.urlopen(request, timeout=8) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                for item in payload.get("claims", [])[:5]:
                    for review in item.get("claimReview", [])[:3]:
                        publisher = review.get("publisher") or {}
                        evidence.append({
                            "source": publisher.get("name", "Google Fact Check"),
                            "title": claim,
                            "link": review.get("url"),
                            "rating_or_stance": review.get("textualRating"),
                        })
            except Exception:  # noqa: BLE001 - the API must stay available
                pass

    # --- NewsAPI (if key configured) ---
    # Could add NewsAPI key later: NEWS_API_KEY

    # --- GDELT-like search (basic implementation) ---
    # Could be expanded with GDELT API integration

    # Deduplicate evidence by link
    seen_links = set()
    deduped = []
    for item in evidence:
        link = item.get("link")
        if link and link in seen_links:
            continue
        if link:
            seen_links.add(link)
        deduped.append(item)
    return deduped[:20]  # max 20 evidence items


@router.post("/analyze")
def analyze(data: AnalyzeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    input_type = data.input_type

    if input_type == "url":
        text, domain, is_https, is_trusted = _extract_url_metadata(data.url)
        # Determine credibility badge label
        if is_https and is_trusted:
            badge = "Trusted source (HTTPS)"
        elif is_https:
            badge = "HTTPS connection"
        else:
            badge = "Non-secure connection"
        result = _save_analysis(text, user, db, {
            "source_url": data.url,
            "source_domain": domain,
            "source_secure": is_https,
            "source_credibility_badge": badge,
        })
        # Add the badge to the response
        result["source_credibility_badge"] = badge
        return result

    if input_type == "image":
        import base64
        from io import BytesIO
        try:
            decoded = base64.b64decode(data.image_base64)
            if len(decoded) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Image must be 5 MB or smaller.")
            from PIL import Image as PILImage
            img = PILImage.open(BytesIO(decoded))
            img = img.convert("RGB")
            text = pytesseract.image_to_string(img)
            text = re.sub(r"\s+", " ", text).strip()
            if not text:
                raise HTTPException(422, "No readable text was found in the image.")
            if len(text) > MAX_ANALYSIS_CHARS:
                text = text[:MAX_ANALYSIS_CHARS]
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 - the API must stay available
            raise HTTPException(422, f"The image could not be read: {exc}") from exc
        result = _save_analysis(text, user, db)
        return result

    # input_type == "text" or default
    if not data.text or len(data.text.strip()) < 10:
        raise HTTPException(422, "Enter at least 10 characters to analyze.")
    text = data.text

    # --- Phase 2: Extract claims and fetch evidence ---
    from ml.factlens_ml.claims import extract_checkable_claims

    claims = extract_checkable_claims(text, limit=10)
    evidence = _fetch_evidence(claims, user)

    result = _save_analysis(text, user, db, {
        "source_url": data.text[:100] if data.text else None,
        "source_claims": claims,
        "source_evidence": evidence,
    })
    # Add claims and evidence to the response
    result["claims"] = claims
    result["evidence"] = evidence
    return result


@router.post("/factcheck")
def factcheck(data: FactCheckIn, _: User = Depends(get_current_user)):
    """Look up a checkable claim using Google Fact Check Tools."""
    api_key = settings.GOOGLE_FACT_CHECK_API_KEY
    if not api_key:
        raise HTTPException(503, "Google Fact Check API is not configured.")

    query = urlencode({"query": data.claim, "languageCode": "en", "key": api_key})
    request = Request(
        f"https://factchecktools.googleapis.com/v1alpha1/claims:search?{query}",
        headers={"Accept": "application/json", "User-Agent": "FactLens/1.0"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise HTTPException(502, "Google Fact Check Tools returned an upstream error.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(502, "Fact-check lookup is temporarily unavailable.") from exc

    matches = []
    for item in payload.get("claims", [])[:10]:
        for review in item.get("claimReview", [])[:5]:
            publisher = review.get("publisher") or {}
            matches.append({
                "rating": review.get("textualRating"),
                "publisher": publisher.get("name"),
                "link": review.get("url"),
                "claim": item.get("text"),
            })
    return {"claim": data.claim, "matches": matches}


@router.post("/analyze-url")
def analyze_url(data: AnalyzeUrlIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    text, domain, secure = _fetch_article(data.url)
    return _save_analysis(text, user, db, {
        "source_url": data.url,
        "source_domain": domain,
        "source_secure": secure,
    })


@router.post("/analyze-file")
def analyze_file(file: UploadFile, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    filename = (file.filename or "").lower()
    suffix = Path(filename).suffix
    if suffix not in {".txt", ".pdf", ".docx"}:
        raise HTTPException(415, "Choose a .txt, .pdf, or .docx file.")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Files must be 5 MB or smaller.")

    try:
        if suffix == ".txt":
            text = content.decode("utf-8-sig")
        elif suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            if len(reader.pages) > 100:
                raise HTTPException(413, "PDF files may contain at most 100 pages.")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            from docx import Document

            document = Document(BytesIO(content))
            parts = [paragraph.text for paragraph in document.paragraphs]
            parts.extend(cell.text for table in document.tables for row in table.rows for cell in row.cells)
            text = "\n".join(parts)
    except HTTPException:
        raise
    except (
        UnicodeError,
        ValueError,
        OSError,
        BadZipFile,
        InvalidXmlError,
        PackageNotFoundError,
        PdfReadError,
        XMLSyntaxError,
    ) as exc:
        raise HTTPException(422, "The selected file could not be read.") from exc

    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 10:
        raise HTTPException(422, "No readable article text was found in the selected file.")
    if len(text) > MAX_ANALYSIS_CHARS:
        raise HTTPException(413, "Extracted text exceeds the 20,000-character analysis limit.")
    return _save_analysis(text, user, db, {"source_file": Path(filename).name})


@router.get("/result/{analysis_id}")
def result(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(Analysis, analysis_id)
    if not row or row.user_id != user.id:
        # TODO: remove stub fallback once real data exists
        if analysis_id == SAMPLE["id"]:
            return SAMPLE
        raise HTTPException(404, "Result not found")
    # `text` is additive so the UI can render word highlights against the source.
    return {"id": row.id, "text": row.text, **row.result}


@router.get("/result/{analysis_id}/report.pdf")
def result_report(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(Analysis, analysis_id)
    if not row or row.user_id != user.id:
        if analysis_id == SAMPLE["id"]:
            payload = dict(SAMPLE)
        else:
            raise HTTPException(404, "Result not found")
    else:
        payload = {"id": row.id, "text": row.text, **row.result}
    pdf = _make_report_pdf(payload)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="factlens-report-{analysis_id}.pdf"'},
    )


@router.get("/history")
def history(
    q: str = Query(default="", max_length=200),
    label: str = Query(default="ALL", pattern="^(ALL|REAL|FAKE|UNCERTAIN)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Analysis).filter(Analysis.user_id == user.id)
    if label != "ALL":
        query = query.filter(Analysis.label == label)
    if q.strip():
        query = query.filter(Analysis.text.ilike(f"%{q.strip()}%"))
    total = query.count()
    rows = query.order_by(Analysis.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [{"id": r.id, "label": r.label, "confidence": r.confidence,
                   "snippet": r.text[:140], "created_at": r.created_at.isoformat(),
                   "source_domain": r.result.get("source_domain"),
                   "source_file": r.result.get("source_file")} for r in rows],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.delete("/history/{analysis_id}", status_code=204)
def delete_history_item(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user.id).first()
    if row is None:
        raise HTTPException(404, "Analysis not found")
    db.delete(row)
    db.commit()
    return None


@router.post("/feedback", status_code=201)
def feedback(data: FeedbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.query(Analysis).filter(Analysis.id == data.analysis_id, Analysis.user_id == user.id).first():
        raise HTTPException(404, "Analysis not found")
    fb = Feedback(user_id=user.id, analysis_id=data.analysis_id, correct=data.correct, comment=data.comment)
    db.add(fb)
    db.commit()
    return {"ok": True, "id": fb.id}


@router.get("/models")
def models(_: User = Depends(get_current_user)):
    """Metrics produced by the training run, plus live artifact status."""
    from ml.factlens_ml.config import METRICS_FILE, ML_ROOT, MODEL_ORDER
    from ml.factlens_ml.registry import get_registry

    registry = get_registry()
    registry.load()
    metrics_path = ML_ROOT / METRICS_FILE
    metrics = {}
    if metrics_path.exists():
        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))

    return {
        "available": registry.available_models,
        "expected": list(MODEL_ORDER),
        "degraded": bool(registry._load_error) or len(registry.available_models) < len(MODEL_ORDER),
        "load_seconds": getattr(registry, "load_seconds", None),
        "error": registry._load_error,
        "metrics": metrics,
    }
