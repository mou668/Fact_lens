"""Text processing, TF-IDF/style features and tokenisation helpers.

The vectoriser is a ``FeatureUnion`` of word n-grams and a small block of
interpretable style features (exclamation rate, ALL-CAPS ratio, ...).  Keeping
style signals *inside* the model means the SHAP values reported by the API
explain real model features instead of post-hoc heuristics.
"""
from __future__ import annotations

import re
from typing import Iterable

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion

from .config import TFIDF

_TOKEN = re.compile(r"[A-Za-z][A-Za-z'’\-]*|\d+|[!?]")
_WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*")
_SENTENCE = re.compile(r"[.!?]+")

# Human-readable labels for the engineered features (used in the UI).
STYLE_LABELS = {
    "exclamation_rate": "Exclamation Rate",
    "question_rate": "Question Rate",
    "caps_ratio": "ALL-CAPS Ratio",
    "allcaps_word_rate": "Shouted Word Rate",
    "digit_rate": "Digit Density",
    "unique_ratio": "Vocabulary Richness",
    "avg_word_len": "Average Word Length",
    "first_person_rate": "First-Person Rate",
    "quote_rate": "Quotation Density",
    "repeated_punct_rate": "Repeated Punctuation",
    "sentence_len": "Average Sentence Length",
    "title_caps_ratio": "Headline Capitalisation",
}


class StyleFeatures(BaseEstimator, TransformerMixin):
    """Small, interpretable stylistic feature block.

    All values are scaled to a comparable range so a linear model can consume
    them next to TF-IDF weights without one block dominating.
    """

    def fit(self, X, y=None):  # noqa: N803 - sklearn API
        return self

    def transform(self, X):  # noqa: N803 - sklearn API
        rows = [self._one(str(t)) for t in X]
        return np.asarray(rows, dtype=np.float32)

    def get_feature_names_out(self, input_features=None):  # noqa: N803
        # FeatureUnion adds the "style__" prefix itself.
        return np.asarray(list(STYLE_LABELS), dtype=object)

    @staticmethod
    def _one(text: str) -> list[float]:
        words = _WORD.findall(text)
        n_words = max(len(words), 1)
        n_chars = max(len(text), 1)
        sentences = max(len(_SENTENCE.findall(text)), 1)
        upper_chars = sum(1 for c in text if c.isupper())
        digits = sum(1 for c in text if c.isdigit())
        allcaps_words = sum(1 for w in words if len(w) > 2 and w.isupper())
        first_person = sum(1 for w in words if w.lower() in {"i", "me", "my", "we", "our", "us"})
        quotes = text.count('"') + text.count("'") + text.count("“") + text.count("”")
        repeated = len(re.findall(r"[!?.]{2,}", text))
        return [
            min(text.count("!") / n_words * 100, 20) / 20,
            min(text.count("?") / n_words * 100, 20) / 20,
            upper_chars / n_chars,
            allcaps_words / n_words,
            min(digits / n_words * 100, 50) / 50,
            len(set(w.lower() for w in words)) / n_words,
            min(np.mean([len(w) for w in words]) if words else 0, 15) / 15,
            first_person / n_words,
            min(quotes / n_words * 100, 30) / 30,
            min(repeated / n_words * 200, 10) / 10,
            min(n_words / sentences, 60) / 60,
            min(upper_chars / max(len(text.split("\n")[0]), 1), 1),
        ]


def build_vectorizer() -> FeatureUnion:
    """TF-IDF word n-grams + style block."""
    return FeatureUnion(
        [
            ("tfidf", TfidfVectorizer(**TFIDF)),
            ("style", StyleFeatures()),
        ],
        transformer_weights={"tfidf": 1.0, "style": 2.5},
    )


def feature_names(union: FeatureUnion) -> list[str]:
    # Drop the Pipeline prefix so the UI shows readable names; the style block
    # keeps its "style__" marker because it is handled separately.
    return [str(n).removeprefix("tfidf__") for n in union.get_feature_names_out()]


def style_index(names: Iterable[str]) -> dict[str, int]:
    return {n: i for i, n in enumerate(names) if n.startswith("style__")}


def tokenize(text: str, max_tokens: int = 400) -> list[str]:
    """Whitespace-ish tokens that keep punctuation attached for the UI."""
    tokens = re.findall(r"[\w'’\-]+|[^\s\w]", text)
    return tokens[:max_tokens]


def word_tokens(text: str) -> list[str]:
    return _WORD.findall(text)
