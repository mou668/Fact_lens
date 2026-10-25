"""Explainability: exact linear SHAP, word attributions, attention payloads and
counterfactual ("what would change the verdict?") search.
"""
from __future__ import annotations

import re
import time

import numpy as np

from .text import STYLE_LABELS

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that",
    "these", "those", "as", "at", "by", "from", "has", "have", "had", "not", "no",
    "he", "she", "they", "we", "you", "i", "his", "her", "their", "our", "your",
    "said", "says", "will", "would", "can", "could", "than", "then", "there", "which",
    "who", "whom", "what", "when", "where", "how", "also", "into", "about", "more",
}
_WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*")


def linear_shap(coefficients: np.ndarray, row, background_mean: np.ndarray):
    """Exact Shapley values for a linear model with independent features.

    ``phi_i = w_i * (x_i - E[x_i])`` - this is the closed-form SHAP value for
    linear models, so no sampling approximation is required.  Accepts both a
    scipy sparse row (inference) and a dense numpy row (tests).
    """
    if hasattr(row, "tocsr"):
        row = row.tocsr()
        idx = row.indices
        values = row.data
    else:
        dense = np.asarray(row, dtype=np.float64).ravel()
        idx = np.nonzero(dense)[0]
        values = dense[idx]
    phi = coefficients[idx] * (values - background_mean[idx])
    return idx, phi


def readable_feature(name: str) -> tuple[str, str]:
    """Map a model feature name to (display name, kind)."""
    if name.startswith("style__"):
        key = name.split("__", 1)[1]
        return STYLE_LABELS.get(key, key.replace("_", " ").title()), "style"
    parts = name.split()
    if len(parts) == 1:
        return f"“{parts[0]}”", "word"
    return f"“{name}”", "phrase"


def top_shap(idx: np.ndarray, phi: np.ndarray, names: list[str], limit: int = 12) -> list[dict]:
    order = np.argsort(-np.abs(phi))[: limit * 3]
    out, seen = [], set()
    for pos in order:
        feature = names[int(idx[pos])]
        display, kind = readable_feature(feature)
        if display in seen:
            continue
        seen.add(display)
        value = float(phi[pos])
        out.append(
            {
                "feature": display,
                "value": round(value, 4),
                "direction": "FAKE" if value > 0 else "REAL",
                "kind": kind,
            }
        )
        if len(out) >= limit:
            break
    return out


def word_attributions(text: str, idx: np.ndarray, phi: np.ndarray, names: list[str]) -> dict[str, float]:
    """Split n-gram SHAP values evenly across the words they contain."""
    scores: dict[str, float] = {}
    for pos, feature_idx in enumerate(idx):
        feature = names[int(feature_idx)]
        if feature.startswith("style__"):
            continue
        parts = feature.split()
        if not parts:
            continue
        share = float(phi[pos]) / len(parts)
        for part in parts:
            key = part.lower()
            scores[key] = scores.get(key, 0.0) + share
    return scores


def highlight_tokens(text: str, scores: dict[str, float], limit: int = 160) -> list[dict]:
    """Character-aligned tokens so the UI can colour the original article."""
    out = []
    for match in _WORD.finditer(text):
        if len(out) >= limit:
            break
        key = match.group(0).lower()
        if key in scores:
            out.append(
                {
                    "word": match.group(0),
                    "score": round(scores[key], 4),
                    "start": match.start(),
                    "end": match.end(),
                }
            )
    return out


def top_words(scores: dict[str, float], limit: int = 15) -> list[dict]:
    ranked = [
        (word, value)
        for word, value in sorted(scores.items(), key=lambda kv: -abs(kv[1]))
        if len(word) > 2 and word not in _STOPWORDS
    ][:limit]
    return [{"word": word, "score": round(value, 4)} for word, value in ranked]


def attention_payload(tokens: list[str], weights: np.ndarray, limit: int = 120) -> dict:
    pairs = [(tok, float(w)) for tok, w in zip(tokens, weights) if tok.strip()]
    if not pairs:
        return {"tokens": [], "source": "none"}
    pairs = pairs[:limit]
    peak = max(w for _, w in pairs) or 1.0
    return {
        "tokens": [{"token": tok, "weight": round(w / peak, 4)} for tok, w in pairs],
        "source": "attention",
    }


def _remove_word(text: str, word: str) -> str:
    pattern = re.compile(rf"\b{re.escape(word)}\b", re.I)
    return re.sub(r"\s{2,}", " ", pattern.sub(" ", text, count=1)).strip()


def counterfactuals(predict_fn, text: str, scores: dict[str, float], label: str, severity: int,
                    original_confidence: float = 0.0, original_p_fake: float = 0.0,
                    max_candidates: int = 6, budget_seconds: float = 2.5) -> dict:
    """Greedy occlusion search for edits that would flip the verdict.

    Only words with a positive FAKE attribution are candidates: those are the
    words the model itself considers evidence, so removing them is a genuine
    counterfactual rather than a random perturbation.
    """
    started = time.time()
    candidates = [
        w for w, s in sorted(scores.items(), key=lambda kv: -kv[1])
        if s > 0 and len(w) > 2 and w not in _STOPWORDS
    ][:max_candidates]

    attempts, options = 0, []
    removed: list[str] = []
    closest = None
    for word in candidates:
        if time.time() - started > budget_seconds:
            break
        trial = text
        tested = removed + [word]
        for token in tested:
            trial = _remove_word(trial, token)
        new_label, new_conf, new_p_fake = predict_fn(trial)
        attempts += 1
        if new_label != label:
            options.append(
                {
                    "remove": tested,
                    "label": new_label,
                    "confidence": round(float(new_conf), 4),
                    "delta": round(float(new_conf) - float(original_confidence), 4),
                    "text": trial[:400],
                }
            )
            removed = []
        else:
            removed.append(word)

        drop = float(original_p_fake) - float(new_p_fake)
        if closest is None or drop > closest["probability_drop"]:
            closest = {
                "remove": tested,
                "label": new_label,
                "confidence": round(float(new_conf), 4),
                "p_fake": round(float(new_p_fake), 4),
                "probability_drop": round(drop, 4),
            }

    options.sort(key=lambda o: -o["confidence"])
    return {
        "flipped": bool(options),
        "attempts": attempts,
        "original": {"label": label, "severity": severity, "p_fake": round(float(original_p_fake), 4)},
        "options": options[:3],
        "closest": closest,
        "note": (
            "Removing these words flips the verdict."
            if options
            else "Removing the model's highest-weighted words did not flip the verdict; the evidence is spread across the text."
        ),
    }
