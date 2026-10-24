"""Central configuration for the FactLens ML pipeline.

Everything tunable lives here so the API, the trainers and the tests agree on
paths, label names and thresholds.
"""
from __future__ import annotations

import os
from pathlib import Path

# ml/  (repo-root/ml)
ML_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("FACTLENS_DATA_DIR", ML_ROOT / "data"))
ARTIFACTS_DIR = Path(os.getenv("FACTLENS_ARTIFACTS_DIR", ML_ROOT / "artifacts"))

TRUE_CSV = DATA_DIR / "True.csv"
FAKE_CSV = DATA_DIR / "Fake.csv"

LABELS = ("REAL", "FAKE")
LABEL_TO_INT = {"REAL": 0, "FAKE": 1}
INT_TO_LABEL = {0: "REAL", 1: "FAKE"}

RANDOM_SEED = 42

# 80 / 10 / 10 stratified split.
SPLIT = {"train": 0.80, "val": 0.10, "test": 0.10}

# --- TF-IDF ---------------------------------------------------------------
TFIDF = {
    "ngram_range": (1, 2),
    "min_df": 3,
    "max_df": 0.90,
    "max_features": 75_000,
    "sublinear_tf": True,
    "strip_accents": "unicode",
}

# --- Classical models -----------------------------------------------------
LR_PARAMS = {"C": 4.0, "max_iter": 2000, "solver": "liblinear", "random_state": RANDOM_SEED}

SVM_PARAMS = {"C": 0.5, "dual": "auto", "max_iter": 5000, "random_state": RANDOM_SEED}
SVM_CALIBRATION_FOLDS = 3

XGB_PARAMS = {
    "n_estimators": 450,
    "max_depth": 6,
    "learning_rate": 0.12,
    "subsample": 0.9,
    "colsample_bytree": 0.6,
    "min_child_weight": 2,
    "tree_method": "hist",
    "eval_metric": "logloss",
    "n_jobs": -1,
    "random_state": RANDOM_SEED,
}
# Keep XGBoost tractable on CPU: chi2-select the strongest TF-IDF columns.
XGB_MAX_FEATURES = 30_000

# --- LSTM -----------------------------------------------------------------
LSTM = {
    "max_len": 200,
    "max_vocab": 40_000,
    "min_freq": 2,
    "embed_dim": 128,
    "hidden_dim": 128,
    "dropout": 0.35,
    "batch_size": 64,
    "epochs": 2,
    "lr": 1e-3,
    "max_train_samples": 18_000,
    "max_eval_samples": 3_000,
}

# --- BERT -----------------------------------------------------------------
BERT = {
    "checkpoint": os.getenv("FACTLENS_BERT_CHECKPOINT", "distilbert-base-uncased"),
    "max_len": 160,
    "batch_size": 16,
    "epochs": 1,
    "lr": 2e-5,
    "max_train_samples": 6_000,
    "max_eval_samples": 1_500,
    "weight_decay": 0.01,
}

# --- Ensemble -------------------------------------------------------------
# Majority vote across the five models. A verdict is only published when the
# winning label has enough support; otherwise the ensemble answers UNCERTAIN.
ENSEMBLE = {
    "min_votes": 4,            # 4/5 agreement is a confident verdict
    "min_votes_relaxed": 3,    # 3/5 is accepted only with high mean confidence
    "relaxed_confidence": 0.75,
    "max_confidence_spread": 0.55,
}

# --- Severity -------------------------------------------------------------
SEVERITY_BANDS = (
    (0, "Low"),
    (30, "Moderate"),
    (60, "High"),
    (80, "Severe"),
)

MODEL_ORDER = ("Logistic Regression", "SVM", "XGBoost", "LSTM", "BERT")

MANIFEST_FILE = "manifest.json"
METRICS_FILE = "metrics.json"
