"""End-to-end self-test for the ML pipeline.

    python -m ml.selftest

Checks the API contract, the ensemble rule, highlight offsets and - when the
``shap`` package is installed - that the analytic linear SHAP values match the
reference implementation.
"""
from __future__ import annotations

import json
import sys
import time

import numpy as np

from .factlens_ml.registry import get_registry

SAMPLES = [
    (
        "FAKE",
        "BREAKING: Deep state insiders reveal the miracle cure they don't want you to know about!!! "
        "Share this now before it is too late. Experts say 97% of doctors are hiding the truth.",
    ),
    (
        "REAL",
        "WASHINGTON (Reuters) - The Federal Reserve raised interest rates by a quarter percentage point on "
        "Wednesday, citing steady job gains and inflation that remains above its 2% target. Policymakers said "
        "further increases would depend on incoming data.",
    ),
    (
        "MIXED",
        "A new study from the University of Michigan found that walking 7,000 steps a day is associated with a "
        "lower risk of premature death, researchers reported in JAMA Network Open. The authors cautioned that "
        "the observational design cannot prove causation.",
    ),
]

REQUIRED = {"label", "confidence", "models", "words", "shap", "severity", "tactics", "attention", "counterfactuals"}


def check_contract(payload: dict, text: str) -> list[str]:
    problems = []
    missing = REQUIRED - payload.keys()
    if missing:
        problems.append(f"missing keys: {sorted(missing)}")
    if payload.get("label") not in {"REAL", "FAKE", "UNCERTAIN"}:
        problems.append(f"bad label {payload.get('label')!r}")
    if not 0 <= payload.get("confidence", -1) <= 1:
        problems.append("confidence out of range")
    if not 0 <= payload.get("severity", -1) <= 100:
        problems.append("severity out of range")
    if len(payload.get("models", [])) != 5:
        problems.append(f"expected 5 models, got {len(payload.get('models', []))}")
    for model in payload.get("models", []):
        if not 0 <= model["confidence"] <= 1:
            problems.append(f"{model['name']} confidence out of range")
    for word in payload.get("words", []):
        if not isinstance(word["word"], str) or not isinstance(word["score"], (int, float)):
            problems.append("bad word entry")
    for highlight in payload.get("highlights", []):
        if not (0 <= highlight["start"] < highlight["end"] <= len(text)):
            problems.append(f"bad highlight offsets for {highlight['word']!r}")
    if payload.get("counterfactuals", {}).get("attempts", 0) < 0:
        problems.append("negative counterfactual attempts")
    return problems


def validate_shap_formula() -> bool:
    """Analytic linear SHAP must equal shap.LinearExplainer on the same model."""
    try:
        import shap
        from sklearn.linear_model import LinearRegression
    except ImportError:
        print("  shap not installed - skipping reference check")
        return True

    rng = np.random.default_rng(0)
    X = rng.normal(size=(120, 6))
    coef = rng.normal(size=6)
    y = X @ coef + 0.5
    model = LinearRegression().fit(X, y)
    background = X[:40]
    explainer = shap.LinearExplainer(model, background)
    reference = explainer.shap_values(X[50:51])[0]

    from .factlens_ml.explain import linear_shap

    idx, phi = linear_shap(model.coef_, X[50:51], background.mean(axis=0))
    analytic = np.zeros(6)
    analytic[idx] = phi
    ok = np.allclose(analytic, reference, atol=1e-6)
    print(f"  analytic SHAP vs shap.LinearExplainer: max diff {np.abs(analytic - reference).max():.2e}")
    return ok


def main() -> int:
    print("Loading artifacts...")
    info = get_registry().load() or {}
    registry = get_registry()
    print(f"  models: {registry.available_models}")
    if registry._load_error:
        print(f"  load error: {registry._load_error}")

    failures = 0
    for expected, text in SAMPLES:
        started = time.time()
        payload = registry.predict(text)
        elapsed = time.time() - started
        problems = check_contract(payload, text)
        status = "ok" if not problems else "FAIL"
        print(
            f"[{status}] expected~{expected:<5} got {payload['label']:<9} "
            f"conf={payload['confidence']:.3f} sev={payload['severity']:>3} "
            f"in {elapsed:.2f}s"
        )
        for problem in problems:
            print(f"       - {problem}")
        failures += bool(problems)

    print("Checking SHAP implementation...")
    if not validate_shap_formula():
        failures += 1

    print(json.dumps({"failures": failures}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
