"""Trainers for the three classical models: Logistic Regression, SVM, XGBoost."""
from __future__ import annotations

import time

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from xgboost import XGBClassifier

from .config import LR_PARAMS, SVM_CALIBRATION_FOLDS, SVM_PARAMS, XGB_MAX_FEATURES, XGB_PARAMS


def _timed(name: str, fn, *args, **kwargs):
    start = time.time()
    model = fn(*args, **kwargs)
    return model, round(time.time() - start, 1)


def train_logistic(X, y):
    model, secs = _timed(
        "lr", LogisticRegression(**LR_PARAMS).fit, X, y
    )
    return model, {"train_seconds": secs}


def train_svm(X, y):
    """Linear SVM wrapped in Platt scaling so it can emit probabilities."""
    base = LinearSVC(**SVM_PARAMS)
    model, secs = _timed(
        "svm",
        CalibratedClassifierCV(base, cv=SVM_CALIBRATION_FOLDS, method="sigmoid").fit,
        X,
        y,
    )
    return model, {"train_seconds": secs, "calibration_folds": SVM_CALIBRATION_FOLDS}


def train_xgb(X, y):
    """XGBoost on the strongest chi2-selected TF-IDF/style columns."""
    k = min(XGB_MAX_FEATURES, X.shape[1])
    selector = SelectKBest(chi2, k=k).fit(X, y)
    Xs = selector.transform(X)
    model, secs = _timed(
        "xgb", XGBClassifier(**XGB_PARAMS).fit, Xs, y
    )
    return (model, selector), {
        "train_seconds": secs,
        "features_used": int(k),
        "features_total": int(X.shape[1]),
    }


def positive_proba(model, X) -> np.ndarray:
    """P(FAKE) for any of the classical wrappers."""
    return np.asarray(model.predict_proba(X))[:, 1]
