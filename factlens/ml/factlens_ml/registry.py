"""Model registry: load artifacts once, run the ensemble, build API payloads."""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import numpy as np

from .config import ARTIFACTS_DIR, METRICS_FILE, MODEL_ORDER
from .ensemble import combine
from .explain import (
    attention_payload,
    counterfactuals,
    highlight_tokens,
    linear_shap,
    top_shap,
    top_words,
    word_attributions,
)
from .tactics import compute_severity, detect_tactics
from .claims import extract_checkable_claims
from .ai_detector import ai_generated_probability

ENGINE_VERSION = "1.0.0"


class ModelRegistry:
    """Thread-safe, lazily loaded holder for every trained artifact."""

    def __init__(self, artifacts_dir: Path | None = None):
        self.dir = Path(artifacts_dir or ARTIFACTS_DIR)
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None
        self.vectorizer = None
        self.lr = None
        self.svm = None
        self.xgb = None
        self.selector = None
        self.names: list[str] = []
        self.background_mean = None
        self.coef = None
        self.lstm = None
        self.bert = None
        self.metrics: dict = {}

    # -- loading ----------------------------------------------------------
    def load(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            started = time.time()
            try:
                self._load_metrics()
                self._load_classical()
                self._load_lstm()
                self._load_bert()
            except Exception as exc:  # pragma: no cover - defensive
                self._load_error = f"{type(exc).__name__}: {exc}"
            self._loaded = True
            self.load_seconds = round(time.time() - started, 1)

    def _load_metrics(self) -> None:
        path = self.dir / METRICS_FILE
        if path.exists():
            self.metrics = json.loads(path.read_text(encoding="utf-8"))

    def _load_classical(self) -> None:
        path = self.dir / "classical.joblib"
        if not path.exists():
            return
        import joblib

        bundle = joblib.load(path)
        self.vectorizer = bundle["vectorizer"]
        self.lr = bundle["lr"]
        self.svm = bundle["svm"]
        self.xgb = bundle["xgb"]
        self.selector = bundle["selector"]
        self.names = bundle["feature_names"]
        self.background_mean = np.asarray(bundle["background_mean"], dtype=np.float64)
        self.coef = np.asarray(bundle["coef"], dtype=np.float64)

    def _load_lstm(self) -> None:
        if not (self.dir / "lstm" / "lstm.pt").exists():
            return
        from .train_lstm import LSTMClassifier

        self.lstm = LSTMClassifier.load(self.dir / "lstm")

    def _load_bert(self) -> None:
        if not (self.dir / "bert" / "config.json").exists():
            return
        from .train_bert import BERTClassifier

        self.bert = BERTClassifier.load(self.dir / "bert")

    # -- inference --------------------------------------------------------
    @property
    def classical_ready(self) -> bool:
        return self.lr is not None and self.svm is not None and self.xgb is not None

    @property
    def available_models(self) -> list[str]:
        out = []
        if self.classical_ready:
            out += ["Logistic Regression", "SVM", "XGBoost"]
        if self.lstm is not None:
            out.append("LSTM")
        if self.bert is not None:
            out.append("BERT")
        return [m for m in MODEL_ORDER if m in out]

    def _classical_probs(self, text: str) -> dict[str, float]:
        X = self.vectorizer.transform([text])
        return {
            "Logistic Regression": float(self.lr.predict_proba(X)[0, 1]),
            "SVM": float(self.svm.predict_proba(X)[0, 1]),
            "XGBoost": float(self.xgb.predict_proba(self.selector.transform(X))[0, 1]),
        }

    def _fast_probs(self, text: str) -> dict[str, float]:
        """Classical + LSTM only. Used by the counterfactual search budget."""
        probs = self._classical_probs(text)
        if self.lstm is not None:
            p, _, _ = self.lstm.predict_proba([text])
            probs["LSTM"] = float(p[0])
        return probs

    def _all_probs(self, text: str):
        probs = self._classical_probs(text)
        attention = None
        attention_tokens = None
        if self.lstm is not None:
            p, weights, tokens = self.lstm.predict_proba([text])
            probs["LSTM"] = float(p[0])
            attention = weights[0]
            attention_tokens = tokens[0]
        if self.bert is not None:
            p, bert_attn, _ = self.bert.predict_proba([text], attention=self.lstm is None)
            probs["BERT"] = float(p[0])
            if attention is None and bert_attn:
                tokens, weights = bert_attn[0]
                attention, attention_tokens = weights, tokens
        return probs, attention, attention_tokens

    def predict(self, text: str) -> dict:
        self.load()
        if not self.available_models:
            return self._fallback(text)

        started = time.time()
        probs, attention, attention_tokens = self._all_probs(text)
        result = combine(probs)

        claims = []
        for claim_text in extract_checkable_claims(text):
            claim_probs, _, _ = self._all_probs(claim_text)
            claim_result = combine(claim_probs)
            claims.append({
                "text": claim_text,
                "label": claim_result["label"],
                "confidence": claim_result["confidence"],
                "p_fake": claim_result["p_fake"],
            })

        tactics, manipulation = detect_tactics(text)
        severity, band = compute_severity(result["p_fake"], manipulation)

        # --- explanation from the linear model (exact SHAP) -------------
        words, shap, highlights, attention_out = [], [], [], {"tokens": [], "source": "none"}
        if self.lr is not None:
            X = self.vectorizer.transform([text])
            idx, phi = linear_shap(self.coef, X, self.background_mean)
            scores = word_attributions(text, idx, phi, self.names)
            words = top_words(scores, limit=15)
            shap = top_shap(idx, phi, self.names, limit=12)
            highlights = highlight_tokens(text, scores)
        else:
            scores = {}

        if attention is not None and attention_tokens:
            attention_out = attention_payload(attention_tokens, attention)
            attention_out["source"] = "lstm" if self.lstm is not None else "bert"

        # --- what would change the verdict? ------------------------------
        budget = 2.0 if self.bert is not None else 1.2

        def _predict_label(candidate: str):
            p, _, _ = self._all_probs(candidate)
            merged = combine(p)
            return merged["label"], merged["confidence"], merged["p_fake"]

        counter = counterfactuals(
            _predict_label,
            text,
            scores,
            result["label"],
            severity,
            original_confidence=result["confidence"],
            original_p_fake=result["p_fake"],
            budget_seconds=budget,
        )

        elapsed = round((time.time() - started) * 1000)
        return {
            **result,
            "claims": claims,
            "ai_generated_probability": ai_generated_probability(text),
            "severity": severity,
            "severity_band": band,
            "manipulation_score": round(manipulation * 100),
            "tactics": tactics,
            "words": words,
            "shap": shap,
            "highlights": highlights,
            "attention": attention_out,
            "counterfactuals": counter,
            "explanation": {
                "source": "Logistic Regression (exact linear SHAP)",
                "attention_source": attention_out["source"],
                "summary": _summary(result, severity, tactics),
            },
            "engine": {
                "version": ENGINE_VERSION,
                "degraded": len(self.available_models) < 5,
                "models_loaded": self.available_models,
                "processing_ms": elapsed,
            },
        }

    # -- fallback ---------------------------------------------------------
    def _fallback(self, text: str) -> dict:
        """Deterministic, clearly-labelled heuristic used when no artifacts exist."""
        tactics, manipulation = detect_tactics(text)
        words = max(len(text.split()), 1)
        caps = sum(1 for c in text if c.isupper()) / max(len(text), 1)
        p_fake = float(np.clip(0.42 + 0.5 * manipulation + 0.8 * (caps - 0.05), 0.03, 0.97))
        label = "FAKE" if p_fake >= 0.5 else "REAL"
        confidence = max(p_fake, 1 - p_fake)
        severity, band = compute_severity(p_fake, manipulation)

        shap = [
            {"feature": t["name"], "value": round(t["score"] / 100, 4), "direction": "FAKE", "kind": "style"}
            for t in tactics[:6]
            if t["score"] > 0
        ]
        tokens = []
        for t in tactics:
            for phrase in t["matches"]:
                tokens.append({"word": phrase.split()[0], "score": round(t["score"] / 100, 3)})

        return {
            "label": label,
            "confidence": round(confidence, 4),
            "models": [
                {"name": "Heuristic (fallback)", "label": label, "confidence": round(confidence, 4),
                 "p_fake": round(p_fake, 4)}
            ],
            "agreement": 1.0,
            "votes": {"FAKE": int(p_fake >= 0.5), "REAL": int(p_fake < 0.5)},
            "p_fake": round(p_fake, 4),
            "spread": 0.0,
            "claims": [{"text": claim, "label": label, "confidence": round(confidence, 4), "p_fake": round(p_fake, 4)} for claim in extract_checkable_claims(text)],
            "ai_generated_probability": ai_generated_probability(text),
            "severity": severity,
            "severity_band": band,
            "manipulation_score": round(manipulation * 100),
            "tactics": tactics,
            "words": tokens[:15],
            "shap": shap,
            "highlights": [],
            "attention": {"tokens": [], "source": "none"},
            "counterfactuals": {
                "flipped": False,
                "attempts": 0,
                "options": [],
                "note": "Train the models (python -m ml.train) to enable counterfactual search.",
            },
            "explanation": {
                "source": "Heuristic fallback (no trained artifacts found)",
                "attention_source": "none",
                "summary": f"Heuristic mode: {words} words, manipulation score {round(manipulation * 100)}/100.",
            },
            "engine": {
                "version": ENGINE_VERSION,
                "degraded": True,
                "models_loaded": [],
                "processing_ms": 0,
                "note": "No artifacts in ml/artifacts - run `python -m ml.train`.",
            },
        }


def _summary(result: dict, severity: int, tactics: list[dict]) -> str:
    top = [t for t in tactics if t["score"] > 0][:2]
    reasons = ", ".join(t["name"].lower() for t in top) or "no strong manipulation tactics"
    votes = result["votes"]
    total = votes["FAKE"] + votes["REAL"]
    if result["label"] == "UNCERTAIN":
        return (
            f"The models disagree ({votes['FAKE']} FAKE / {votes['REAL']} REAL of {total}), "
            f"so no verdict is published. Severity {severity}/100 with {reasons}."
        )
    return (
        f"{votes[result['label']]} of {total} models classify this as {result['label']}. "
        f"Severity {severity}/100 with {reasons}."
    )


_registry: ModelRegistry | None = None
_registry_lock = threading.Lock()


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        with _registry_lock:
            if _registry is None:
                _registry = ModelRegistry()
    return _registry


def predict(text: str) -> dict:
    return get_registry().predict(text)
