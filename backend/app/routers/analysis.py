"""Analysis endpoints.

The real pipeline lives in ``ml/predict.py`` (owner: ML teammate).  The
response keeps every field from the original contract and only *adds* the
explainability fields (severity, tactics, attention, counterfactuals).
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Analysis, Feedback, User
from ..schemas import AnalyzeIn, FeedbackIn

logger = logging.getLogger("factlens.analysis")

router = APIRouter(prefix="/api", tags=["analysis"])

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


@router.post("/analyze")
def analyze(data: AnalyzeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = run_model(data.text)
    row = Analysis(user_id=user.id, text=data.text, label=out["label"],
                   confidence=out["confidence"], result=out)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, **out}


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


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(Analysis).filter(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc()).limit(100).all())
    return [{"id": r.id, "label": r.label, "confidence": r.confidence,
             "snippet": r.text[:140], "created_at": r.created_at.isoformat()} for r in rows]


@router.post("/feedback", status_code=201)
def feedback(data: FeedbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
