"""Extract checkable factual claims from article text."""
from __future__ import annotations

import re


def split_sentences(text: str) -> list[str]:
    """Use spaCy when available, with a stdlib fallback for slim deployments."""
    try:
        import spacy

        nlp = spacy.blank("en")
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return [sent.text.strip() for sent in nlp(text[:20000]).sents if sent.text.strip()]
    except Exception:
        parts = re.split(r"(?<=[.!?])\s+|\n+", text)
        return [part.strip() for part in parts if part.strip()]


_CHECKABLE_HINTS = (
    r"\b(is|are|was|were|will|has|have|had|caused|killed|said|reported|shows?|claims?|found|according|won|lost|announced|confirmed)\b",
    r"\b\d+(?:[.,]\d+)?%?\b",
    r"\b(million|billion|percent|yesterday|today|tomorrow)\b",
)
_OPINION_HINTS = re.compile(r"\b(i think|believe|feel|opinion|should|best|worst|beautiful|terrible)\b", re.I)


def extract_checkable_claims(text: str, limit: int = 10) -> list[str]:
    claims: list[str] = []
    for sentence in split_sentences(text):
        cleaned = re.sub(r"\s+", " ", sentence).strip()
        if len(cleaned) < 10 or len(cleaned) > 500:
            continue
        if cleaned.endswith("?") or _OPINION_HINTS.search(cleaned):
            continue
        if not any(re.search(pattern, cleaned, re.I) for pattern in _CHECKABLE_HINTS):
            continue
        if cleaned not in claims:
            claims.append(cleaned)
        if len(claims) >= limit:
            break
    return claims
