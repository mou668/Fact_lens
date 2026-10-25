"""Manipulation-tactic detection and severity scoring.

The detector is deliberately transparent: every signal is a named, reviewable
lexicon or a measurable style property, and each one reports the exact phrases
it matched so the Result page can show evidence rather than a black box.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from .config import SEVERITY_BANDS


@dataclass(frozen=True)
class Tactic:
    id: str
    name: str
    description: str
    weight: float
    patterns: tuple[str, ...] = ()


TACTICS: tuple[Tactic, ...] = (
    Tactic(
        "conspiracy",
        "Conspiracy framing",
        "Claims that hidden actors are suppressing the truth.",
        0.18,
        (
            r"deep state",
            r"cover[- ]?up",
            r"they don'?t want you to know",
            r"mainstream media",
            r"msm",
            r"wake up",
            r"globalist",
            r"new world order",
            r"big pharma",
            r"plandemic",
            r"hidden agenda",
            r"secret(ly)? (plan|agenda|cure)",
            r"suppress(ed|ing)",
        ),
    ),
    Tactic(
        "sensationalism",
        "Sensationalism",
        "Hyperbolic language designed to provoke an emotional reaction.",
        0.16,
        (
            r"shocking",
            r"bombshell",
            r"explosive",
            r"miracle",
            r"unbelievable",
            r"stunning",
            r"mind[- ]blowing",
            r"jaw[- ]dropping",
            r"insane",
            r"horrifying",
            r"devastating",
        ),
    ),
    Tactic(
        "urgency",
        "Manufactured urgency",
        "Pushes the reader to act or share immediately, before verification.",
        0.12,
        (
            r"breaking( news)?",
            r"urgent",
            r"act now",
            r"before it'?s too late",
            r"share (this )?(now|before)",
            r"must (read|see|share)",
            r"just in",
            r"time is running out",
            r"don'?t wait",
        ),
    ),
    Tactic(
        "vague_attribution",
        "Vague attribution",
        "Cites unnamed experts, sources or studies instead of checkable references.",
        0.12,
        (
            r"sources (say|claim|close)",
            r"experts (say|agree|warn)",
            r"scientists (say|confirm|discover)",
            r"reportedly",
            r"allegedly",
            r"many people are saying",
            r"some say",
            r"it is (said|rumou?red)",
            r"studies (show|prove)",
            r"research (shows|proves)",
            r"according to (sources|insiders)",
        ),
    ),
    Tactic(
        "absolutism",
        "Absolute certainty",
        "Presents contested claims as proven fact with no room for doubt.",
        0.10,
        (
            r"100%",
            r"undeniable",
            r"indisputable",
            r"no doubt",
            r"definitely",
            r"everyone knows",
            r"completely (proven|true)",
            r"always",
            r"never",
            r"proof that",
        ),
    ),
    Tactic(
        "emotional_appeal",
        "Emotional manipulation",
        "Uses outrage, fear or disgust in place of evidence.",
        0.10,
        (
            r"outrage(ous)?",
            r"disgusting",
            r"evil",
            r"shameful",
            r"heartbreaking",
            r"terrifying",
            r"you won'?t believe",
            r"how dare",
            r"pathetic",
            r"traitor",
        ),
    ),
    Tactic(
        "clickbait",
        "Clickbait framing",
        "Curiosity-gap phrasing typical of engagement farming.",
        0.08,
        (
            r"you won'?t believe",
            r"this one (trick|weird)",
            r"what happened next",
            r"must see",
            r"goes viral",
            r"the internet is (shocked|divided)",
            r"wait till you see",
        ),
    ),
    Tactic(
        "pseudoscience",
        "Pseudo-scientific claims",
        "Miracle cures and detox language without clinical evidence.",
        0.08,
        (
            r"miracle cure",
            r"natural cure",
            r"detox",
            r"toxins",
            r"cures? (cancer|diabetes)",
            r"doctors (hate|don'?t want)",
            r"big pharma",
            r"immune booster",
        ),
    ),
    Tactic(
        "unverified_stats",
        "Unsourced statistics",
        "Numbers and percentages presented without a citation.",
        0.06,
        (
            r"\b\d{1,3}(?:\.\d+)?\s?%",
            r"\b\d{2,}\s+(?:people|studies|experts|countries)\b",
            r"statistics (show|prove)",
            r"data (shows|proves)",
        ),
    ),
)

_COMPILED = {t.id: [re.compile(p, re.I) for p in t.patterns] for t in TACTICS}
_SENTENCE = re.compile(r"[^.!?]{0,120}[.!?]")
_REPEAT_PUNCT = re.compile(r"[!?]{2,}")


def _matches(text: str, tactic_id: str) -> list[str]:
    found: list[str] = []
    for rx in _COMPILED[tactic_id]:
        for m in rx.finditer(text):
            phrase = m.group(0).strip()
            if phrase and phrase.lower() not in {f.lower() for f in found}:
                found.append(phrase)
    return found[:8]


def detect_tactics(text: str) -> tuple[list[dict], float]:
    """Return per-tactic results plus an overall manipulation score in [0, 1]."""
    words = max(len(re.findall(r"[A-Za-z']+", text)), 1)
    results = []
    weighted = 0.0

    for tactic in TACTICS:
        hits = _matches(text, tactic.id)
        # Normalise by length so a long article is not penalised for one phrase,
        # then use a saturating curve: one phrase is moderate evidence, several
        # distinct phrases are strong evidence.
        density = len(hits) / math.sqrt(max(words, 50) / 100)
        score = 1.0 - math.exp(-0.55 * density)
        weighted += tactic.weight * score
        results.append(
            {
                "id": tactic.id,
                "name": tactic.name,
                "description": tactic.description,
                "score": round(score * 100),
                "matches": hits,
            }
        )

    # Style signals that no lexicon can capture.
    caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    shouted = len(re.findall(r"\b[A-Z]{4,}\b", text)) / words
    repeated = len(_REPEAT_PUNCT.findall(text))
    style = min(1.0, (caps_ratio / 0.12) * 0.45 + (shouted * 100 / 4) * 0.35 + (repeated / 4) * 0.20)
    weighted += 0.10 * style
    results.append(
        {
            "id": "style",
            "name": "Aggressive styling",
            "description": "ALL-CAPS words, shouting and repeated punctuation.",
            "score": round(style * 100),
            "matches": ([f"{repeated} repeated punctuation marks"] if repeated else [])
            + ([f"{shouted * 100:.1f} shouted words per 100"] if shouted else []),
        }
    )

    total_weight = sum(t.weight for t in TACTICS) + 0.10
    manipulation = min(1.0, weighted / total_weight)
    # Rank so the most present tactic is first.
    results.sort(key=lambda r: r["score"], reverse=True)
    return results, manipulation


def compute_severity(p_fake: float, manipulation: float) -> tuple[int, str]:
    """Blend model probability with manipulation evidence into 0-100."""
    score = round(100 * max(0.0, min(1.0, 0.55 * p_fake + 0.45 * manipulation)))
    band = next(name for cut, name in reversed(SEVERITY_BANDS) if score >= cut)
    return score, band
