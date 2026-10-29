"""Training orchestration for FactLens.

Usage
-----
    python -m ml.train            # full run (30-60 min on CPU)
    python -m ml.train --quick    # smoke test: tiny subsets, no BERT
    python -m ml.train --skip-bert
    python -m ml.train --stage classical

Artifacts land in ``ml/artifacts`` and ``ml/metrics.json`` is written from the
actual held-out test results produced by this run.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np

from .factlens_ml import config
from .factlens_ml.data import build_dataset, split_dataset
from .factlens_ml.ensemble import combine
from .factlens_ml.evaluate import classification_metrics, macro_summary
from .factlens_ml.models_classical import positive_proba, train_logistic, train_svm, train_xgb
from .factlens_ml.text import build_vectorizer, feature_names

SEED = config.RANDOM_SEED


def log(message: str) -> None:
    print(message, flush=True)


def _subset(df, n: int):
    return df.head(min(n, len(df)))


def _predict_lstm(lstm, texts, batch: int = 256):
    probs = []
    for start in range(0, len(texts), batch):
        p, _, _ = lstm.predict_proba(list(texts[start : start + batch]))
        probs.extend(p.tolist())
    return np.asarray(probs)


def train(args) -> dict:  # noqa: C901 - orchestration reads best linearly
    started = time.time()
    config.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    log("== 1/6 Loading ISOT dataset ==")
    df = build_dataset()
    stats = df.attrs["stats"]
    log(f"   {stats['rows_clean']} usable rows {stats['class_counts']}")
    splits = split_dataset(df)
    log(f"   split={ {k: len(v) for k, v in splits.items()} }")

    if args.quick:
        for key in splits:
            splits[key] = splits[key].head(1200 if key == "train" else 300)

    train_df, val_df, test_df = splits["train"], splits["val"], splits["test"]

    log("== 2/6 TF-IDF + style features ==")
    vectorizer = build_vectorizer()
    X_train = vectorizer.fit_transform(train_df["clean_text"])
    X_val = vectorizer.transform(val_df["clean_text"])
    X_test = vectorizer.transform(test_df["clean_text"])
    names = feature_names(vectorizer)
    log(f"   matrix={X_train.shape} features={len(names)}")

    mean_sample = X_train[: min(2000, X_train.shape[0])]
    background_mean = np.asarray(mean_sample.mean(axis=0)).ravel()

    y_train, y_val, y_test = train_df["label_id"].to_numpy(), val_df["label_id"].to_numpy(), test_df["label_id"].to_numpy()

    model_reports: dict[str, dict] = {}
    val_probs: dict[str, np.ndarray] = {}
    test_probs: dict[str, np.ndarray] = {}

    log("== 3/6 Classical models (LR, SVM, XGBoost) ==")
    lr, lr_info = train_logistic(X_train, y_train)
    val_probs["Logistic Regression"] = positive_proba(lr, X_val)
    test_probs["Logistic Regression"] = positive_proba(lr, X_test)
    model_reports["Logistic Regression"] = {"info": lr_info, "params": config.LR_PARAMS}

    svm, svm_info = train_svm(X_train, y_train)
    val_probs["SVM"] = positive_proba(svm, X_val)
    test_probs["SVM"] = positive_proba(svm, X_test)
    model_reports["SVM"] = {"info": svm_info, "params": config.SVM_PARAMS}

    (xgb, selector), xgb_info = train_xgb(X_train, y_train)
    val_probs["XGBoost"] = positive_proba(xgb, selector.transform(X_val))
    test_probs["XGBoost"] = positive_proba(xgb, selector.transform(X_test))
    model_reports["XGBoost"] = {"info": xgb_info, "params": config.XGB_PARAMS}

    for name, probs in val_probs.items():
        model_reports[name]["val"] = classification_metrics(y_val, probs)
        log(f"   {name:<20} val acc={model_reports[name]['val']['accuracy']}")

    joblib.dump(
        {
            "vectorizer": vectorizer,
            "lr": lr,
            "svm": svm,
            "xgb": xgb,
            "selector": selector,
            "feature_names": names,
            "background_mean": background_mean,
            "coef": lr.coef_[0],
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        config.ARTIFACTS_DIR / "classical.joblib",
        compress=3,
    )
    log("   saved classical.joblib")

    # -- LSTM -----------------------------------------------------------
    lstm = None
    if not args.skip_lstm:
        log("== 4/6 LSTM with attention ==")
        from .factlens_ml.train_lstm import train_lstm

        lstm_train = _subset(train_df, config.LSTM["max_train_samples"])
        lstm, lstm_info = train_lstm(
            lstm_train["clean_text"], lstm_train["label_id"], val_df["clean_text"], val_df["label_id"], log=log
        )
        lstm_dir = config.ARTIFACTS_DIR / "lstm"
        lstm.save(lstm_dir)

        n = min(1500, len(val_df))
        val_probs["LSTM"] = _predict_lstm(lstm, val_df["clean_text"].head(n))
        model_reports["LSTM"] = {"info": lstm_info, "params": config.LSTM}
        model_reports["LSTM"]["val"] = classification_metrics(val_df["label_id"].to_numpy()[:n], val_probs["LSTM"])
        log(f"   LSTM val acc={model_reports['LSTM']['val']['accuracy']}")

        n_test = min(1500, len(test_df))
        test_probs["LSTM"] = _predict_lstm(lstm, test_df["clean_text"].head(n_test))
        model_reports["LSTM"]["test"] = classification_metrics(
            test_df["label_id"].to_numpy()[:n_test], test_probs["LSTM"]
        )
        log("   saved lstm/")

    # -- BERT -----------------------------------------------------------
    bert = None
    if args.with_bert and not args.quick:
        log("== 5/6 Fine-tuning BERT (" + config.BERT["checkpoint"] + ") ==")
        from .factlens_ml.train_bert import train_bert

        bert_train = _subset(train_df, config.BERT["max_train_samples"])
        bert, bert_info = train_bert(
            bert_train["clean_text"], bert_train["label_id"], val_df["clean_text"], val_df["label_id"], log=log
        )

        bert_dir = config.ARTIFACTS_DIR / "bert"
        bert.save(bert_dir)

        n = min(config.BERT["max_eval_samples"], len(val_df))
        val_probs["BERT"] = bert.predict_proba(list(val_df["clean_text"].head(n)))[0]
        model_reports["BERT"] = {"info": bert_info, "params": config.BERT}
        model_reports["BERT"]["val"] = classification_metrics(val_df["label_id"].to_numpy()[:n], val_probs["BERT"])
        log(f"   BERT val acc={model_reports['BERT']['val']['accuracy']}")

        n_test = min(1500, len(test_df))
        test_probs["BERT"] = bert.predict_proba(list(test_df["clean_text"].head(n_test)))[0]
        model_reports["BERT"]["test"] = classification_metrics(
            test_df["label_id"].to_numpy()[:n_test], test_probs["BERT"]
        )
        log("   saved bert/")
    else:
        log("== 5/6 Skipping BERT (enable with --with-bert) ==")

    # -- test metrics ---------------------------------------------------
    log("== 6/6 Held-out test evaluation ==")
    full_test_models = ("Logistic Regression", "SVM", "XGBoost")
    for name in full_test_models:
        model_reports[name]["test"] = classification_metrics(y_test, test_probs[name])
        log(f"   {name:<20} test acc={model_reports[name]['test']['accuracy']}")

    # Ensemble is evaluated on the rows every model scored.
    eval_len = min(
        [len(test_probs[m]) for m in test_probs if m != "BERT"] + [len(test_probs["BERT"]) if "BERT" in test_probs else 10**9]
    )
    ensemble_rows = min(eval_len, 1500)
    ensemble_probs = {name: probs[:ensemble_rows] for name, probs in test_probs.items()}
    labels = test_df["label_id"].to_numpy()[:ensemble_rows]

    ensemble_labels, ensemble_conf, ensemble_pred = [], [], []
    for i in range(ensemble_rows):
        merged = combine({name: float(probs[i]) for name, probs in ensemble_probs.items()})
        ensemble_labels.append(merged["label"])
        ensemble_conf.append(merged["confidence"])
        ensemble_pred.append(1 if merged["label"] == "FAKE" else 0)

    decided = np.array([lab != "UNCERTAIN" for lab in ensemble_labels])
    decided_acc = float(np.mean([p == t for p, t, d in zip(ensemble_pred, labels, decided) if d])) if decided.any() else None
    false_positive = int(np.sum((np.array(ensemble_pred) == 1) & (labels == 0)))
    false_negative = int(np.sum((np.array(ensemble_pred) == 0) & (labels == 1)))

    ensemble_report = {
        "test_subset": int(ensemble_rows),
        "coverage": round(float(decided.mean()), 4),
        "accuracy_on_decided": round(decided_acc, 4) if decided_acc is not None else None,
        "uncertain": int((~decided).sum()),
        "false_positives": false_positive,
        "false_negatives": false_negative,
        "mean_confidence": round(float(np.mean(ensemble_conf)), 4),
        "vote_distribution": {
            "FAKE": int(sum(1 for lab in ensemble_labels if lab == "FAKE")),
            "REAL": int(sum(1 for lab in ensemble_labels if lab == "REAL")),
            "UNCERTAIN": int((~decided).sum()),
        },
        "majority_vote": config.ENSEMBLE,
    }

    metrics = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "name": "ISOT Fake News (Kaggle)" + (" + 2020+ CSV (FACTLENS_NEW_DATA_CSV)" if os.getenv("FACTLENS_NEW_DATA_CSV") else ""),
            "raw_rows": stats["rows_raw"],
            "clean_rows": stats["rows_clean"],
            "dropped_short_or_duplicate": stats["dropped_short_or_duplicate"],
            "class_counts": stats["class_counts"],
            "split": {k: len(v) for k, v in splits.items()},
            "deduplicated": True,
            "reuters_datelines_stripped": True,
        },
        "models": model_reports,
        "ensemble": ensemble_report,
        "summary": macro_summary({k: v["test"] for k, v in model_reports.items() if "test" in v}),
        "system": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "cpu_count": __import__("os").cpu_count(),
            "random_seed": SEED,
            "quick_mode": bool(args.quick),
            "training_seconds": round(time.time() - started, 1),
        },
    }

    (config.ML_ROOT / config.METRICS_FILE).write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    log(f"   wrote {config.ML_ROOT / config.METRICS_FILE}")
    log(f"Done in {round(time.time() - started, 1)}s")
    return metrics


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Train FactLens models on the ISOT dataset")
    parser.add_argument("--quick", action="store_true", help="tiny subsets, no BERT (smoke test)")
    parser.add_argument("--skip-lstm", action="store_true")
    parser.add_argument("--with-bert", action="store_true", help="fine-tune the BERT model (slow on CPU)")
    args = parser.parse_args(argv)

    if args.quick:
        args.with_bert = False
        config.LSTM["epochs"] = 1
        config.LSTM["max_train_samples"] = 1200
        config.BERT["max_train_samples"] = 200

    train(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
