"""Lightweight AI-generated-text probability detector.

This intentionally uses observable prose features and returns a calibrated 0-1
score. It is not presented as a definitive authorship classifier.
"""
from __future__ import annotations

import math
import re
from statistics import pstdev


_SENTENCE_SPLIT = re.compile(r"[.!?]+(?:\s+|$)")
_WORD = re.compile(r"\b[\w'-]+\b", re.UNICODE)


def ai_generated_probability(text: str) -> float:
    """Estimate AI-style prose likelihood from repetitions, transitions and structure."""
    if not isinstance(text, str):
        return 0.0
    normalized = re.sub(r"\s+", " ", text.strip())
    if len(normalized) < 40:
        return 0.0

    words = _WORD.findall(normalized.lower())
    if len(words) < 8:
        return 0.0
    sentences = [part.strip() for part in _SENTENCE_SPLIT.split(normalized) if part.strip()]
    if not sentences:
        sentences = [normalized]

    sentence_lengths = [len(_WORD.findall(sentence)) for sentence in sentences]
    mean_length = sum(sentence_lengths) / max(len(sentence_lengths), 1)
    length_variation = pstdev(sentence_lengths) if len(sentence_lengths) > 1 else 0.0

    transition_phrases = (
        "in conclusion", "it is important", "overall", "moreover", "furthermore",
        "in summary", "as a result", "on the other hand", "in today's", "the key",
    )
    lower = normalized.lower()
    transition_hits = sum(lower.count(phrase) for phrase in transition_phrases)

    unique_ratio = len(set(words)) / len(words)
    repeated_long_words = sum(
        1 for word in set(words)
        if len(word) >= 8 and lower.count(" " + word + " ") >= 3
    )

    score = 0.46
    if 12 <= mean_length <= 22:
        score += 0.10
    else:
        score -= 0.04
    if length_variation < 5:
        score += 0.10
    elif length_variation > 12:
        score -= 0.07
    if 0.45 <= unique_ratio <= 0.68:
        score += 0.07
    if transition_hits:
        score += min(0.18, 0.06 * transition_hits)
    if repeated_long_words:
        score -= min(0.12, 0.04 * repeated_long_words)

    return round(max(0.0, min(1.0, 1.0 / (1.0 + math.exp(-5.0 * (score - 0.50))))), 4)
