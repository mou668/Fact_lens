"""FactLens ML entry point (imported by the backend).

`predict(text)` returns the analysis payload described in the project README.
"""
from __future__ import annotations

from .factlens_ml.registry import get_registry, predict

__all__ = ["predict", "warmup"]


def warmup() -> dict:
    """Load every artifact now instead of on the first request."""
    registry = get_registry()
    registry.load()
    return {
        "models_loaded": registry.available_models,
        "load_seconds": getattr(registry, "load_seconds", None),
        "error": registry._load_error,
    }
