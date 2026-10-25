"""Majority-vote ensemble with explicit UNCERTAIN handling."""
from __future__ import annotations

import numpy as np

from .config import ENSEMBLE, MODEL_ORDER


def combine(model_probs: dict[str, float]) -> dict:
    """Aggregate per-model P(FAKE) into a verdict.

    A label needs at least ``min_votes`` of the five models, or a relaxed three
    votes when the mean confidence is high and the models do not wildly
    disagree.  Anything else is reported as UNCERTAIN rather than a guess.
    """
    names = [n for n in MODEL_ORDER if n in model_probs] + [n for n in model_probs if n not in MODEL_ORDER]
    probs = np.asarray([model_probs[n] for n in names], dtype=float)
    votes = (probs >= 0.5).astype(int)
    fake_votes = int(votes.sum())
    real_votes = int(len(votes) - fake_votes)

    mean_p_fake = float(probs.mean())
    spread = float(probs.max() - probs.min())

    if fake_votes > real_votes:
        majority, support = "FAKE", fake_votes
    elif real_votes > fake_votes:
        majority, support = "REAL", real_votes
    else:
        majority, support = None, max(fake_votes, real_votes)

    confidence = mean_p_fake if majority == "FAKE" else 1.0 - mean_p_fake

    confident = (
        support >= ENSEMBLE["min_votes"] and spread <= ENSEMBLE["max_confidence_spread"]
    ) or (
        support >= ENSEMBLE["min_votes_relaxed"]
        and confidence >= ENSEMBLE["relaxed_confidence"]
        and spread <= ENSEMBLE["max_confidence_spread"]
    )
    # Degraded pipelines may expose fewer than three models; then require a
    # unanimous, high-confidence vote instead of a majority of five.
    if len(votes) < 3:
        confident = support == len(votes) and confidence >= ENSEMBLE["relaxed_confidence"]
    label = majority if (majority and confident) else "UNCERTAIN"

    if label == "UNCERTAIN":
        # How strongly the ensemble leans one way, not a published verdict.
        confidence = float(max(mean_p_fake, 1.0 - mean_p_fake))

    models = []
    for name, p in zip(names, probs):
        model_label = "FAKE" if p >= 0.5 else "REAL"
        models.append(
            {
                "name": name,
                "label": model_label,
                "confidence": round(float(p if model_label == "FAKE" else 1.0 - p), 4),
                "p_fake": round(float(p), 4),
            }
        )

    return {
        "label": label,
        "confidence": round(float(confidence), 4),
        "models": models,
        "agreement": round(float(support / max(len(votes), 1)), 3),
        "votes": {"FAKE": fake_votes, "REAL": real_votes},
        "p_fake": round(mean_p_fake, 4),
        "spread": round(spread, 4),
    }
