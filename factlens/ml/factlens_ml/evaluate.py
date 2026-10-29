"""Metric helpers shared by the trainers and the ensemble report."""
from __future__ import annotations

from typing import Sequence

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


def classification_metrics(y_true: Sequence[int], y_prob: Sequence[float], threshold: float = 0.5) -> dict:
    """Binary metrics with FAKE as the positive class."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob, dtype=float)
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "support": int(len(y_true)),
    }
    try:
        metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_prob)), 4)
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        if len(fpr) > 101:
            indices = np.linspace(0, len(fpr) - 1, 101).round().astype(int)
            fpr, tpr = fpr[indices], tpr[indices]
        metrics["roc_curve"] = {
            "fpr": [round(float(v), 6) for v in fpr],
            "tpr": [round(float(v), 6) for v in tpr],
        }
    except ValueError:
        metrics["roc_auc"] = None
        metrics["roc_curve"] = {"fpr": [], "tpr": []}
    return metrics


def macro_summary(per_model: dict[str, dict]) -> dict:
    keys = ("accuracy", "precision", "recall", "f1", "roc_auc")
    out = {}
    for key in keys:
        vals = [m[key] for m in per_model.values() if m.get(key) is not None]
        out[key] = round(float(np.mean(vals)), 4) if vals else None
    return out


def severity_band(score: int) -> str:
    if score >= 80:
        return "Severe"
    if score >= 60:
        return "High"
    if score >= 30:
        return "Moderate"
    return "Low"
