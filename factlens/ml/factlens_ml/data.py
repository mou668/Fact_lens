"""Dataset loading and cleaning for the ISOT / Kaggle fake-news corpus.

The public ISOT release ships as two CSV files (``True.csv`` / ``Fake.csv``)
with ``title, text, subject, date``.  A few well-known artefacts are cleaned
here so the models learn language rather than dataset fingerprints:

* Reuters wire datelines at the start of real articles
* publisher prefixes used by the fake-news crawls (e.g. "21st Century Wire")
* HTML entities / leftover markup
* exact duplicate articles (the corpus contains many)
"""
from __future__ import annotations

import html
import os
import re
from pathlib import Path

import pandas as pd

from .config import FAKE_CSV, INT_TO_LABEL, LABEL_TO_INT, RANDOM_SEED, SPLIT, TRUE_CSV

# "WASHINGTON (Reuters) - " / "NEW YORK (Reuters) -"
_REUTERS = re.compile(r"^\s*[A-Z][A-Za-z .,'/-]{0,40}\(Reuters\)\s*[-–—]\s*", re.I)
# "21st Century Wire" style site attribution at the very start of an article.
_SITE_PREFIX = re.compile(
    r"^\s*(?:21st\s*Century\s*Wire|Before\s*It'?s\s*News|The\s*Daily\s*Sheeple|"
    r"Activist\s*Post|Neon\s*Nettle)\s*[:\-–—|]\s*",
    re.I,
)
_WS = re.compile(r"\s+")
_URL = re.compile(r"https?://\S+|www\.\S+")


def clean_text(text: str) -> str:
    """Normalise an article while keeping the prose (and its style) intact."""
    if not isinstance(text, str):
        return ""
    text = html.unescape(text)
    text = _REUTERS.sub("", text)
    text = _SITE_PREFIX.sub("", text)
    text = _URL.sub(" ", text)
    text = text.replace("\u00a0", " ")
    return _WS.sub(" ", text).strip()


def _normalise_for_dedupe(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", text.lower())[:4000]


def load_raw() -> pd.DataFrame:
    """Read both CSVs and return ``label`` + ``text`` columns."""
    frames = []
    for path, label in ((TRUE_CSV, "REAL"), (FAKE_CSV, "FAKE")):
        if not path.exists():
            raise FileNotFoundError(
                f"Missing {path}. Download the ISOT dataset (True.csv / Fake.csv) into {path.parent}."
            )
        df = pd.read_csv(path)
        missing = {"title", "text"} - set(df.columns)
        if missing:
            raise ValueError(f"{path} is missing columns: {sorted(missing)}")
        df = df[["title", "text"]].copy()
        df["label"] = label
        frames.append(df)
    newer_csv = os.getenv("FACTLENS_NEW_DATA_CSV", "").strip()
    if newer_csv:
        newer_path = Path(newer_csv)
        if not newer_path.exists():
            raise FileNotFoundError(f"FACTLENS_NEW_DATA_CSV points to missing file: {newer_path}")
        newer = pd.read_csv(newer_path)
        text_column = next((name for name in ("text", "article", "content", "claim", "title") if name in newer.columns), None)
        label_column = next((name for name in ("label", "class", "target", "is_fake", "fake") if name in newer.columns), None)
        if text_column is None or label_column is None:
            raise ValueError(f"{newer_path} must contain a text/article column and label/class/target column")

        date_column = next((name for name in ("date", "published_at", "publish_date", "timestamp") if name in newer.columns), None)
        if date_column:
            dates = pd.to_datetime(newer[date_column], errors="coerce", utc=True)
            newer = newer[dates.dt.year >= 2020].copy()

        def normalize_label(value):
            raw = str(value).strip().lower()
            if raw in {"0", "real", "true", "legitimate", "reliable"}:
                return "REAL"
            if raw in {"1", "fake", "false", "misleading", "unreliable"}:
                return "FAKE"
            return ""

        newer["title"] = newer[text_column].fillna("").astype(str).str.slice(0, 300)
        newer["text"] = newer[text_column].fillna("").astype(str)
        newer["label"] = newer[label_column].map(normalize_label)
        newer = newer[newer["label"] != ""][["title", "text", "label"]]
        if newer.empty:
            raise ValueError(f"{newer_path} contained no usable 2020+ labeled rows")
        frames.append(newer)

    out = pd.concat(frames, ignore_index=True)
    out["label_id"] = out["label"].map(LABEL_TO_INT)
    return out


def build_dataset(min_chars: int = 120) -> pd.DataFrame:
    """Clean, deduplicate and validate the corpus.

    Adds a ``clean_text`` column used by every model and drops rows whose text
    is too short to be meaningful.
    """
    df = load_raw()
    df["title"] = df["title"].fillna("").astype(str).str.strip()
    df["text"] = df["text"].fillna("").astype(str)
    df["clean_text"] = df["text"].map(clean_text)

    before = len(df)
    df = df[df["clean_text"].str.len() >= min_chars].copy()
    df["dedupe_key"] = df["clean_text"].map(_normalise_for_dedupe)
    df = df.drop_duplicates("dedupe_key").drop(columns=["dedupe_key"])
    df = df.drop_duplicates("clean_text")
    df = df.reset_index(drop=True)

    stats = {
        "rows_raw": int(before),
        "rows_clean": int(len(df)),
        "dropped_short_or_duplicate": int(before - len(df)),
        "class_counts": df["label"].value_counts().to_dict(),
    }
    df.attrs["stats"] = stats
    return df


def split_dataset(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Deterministic stratified 80/10/10 split."""
    from sklearn.model_selection import train_test_split

    train, rest = train_test_split(
        df, train_size=SPLIT["train"], stratify=df["label_id"], random_state=RANDOM_SEED
    )
    val_share = SPLIT["val"] / (SPLIT["val"] + SPLIT["test"])
    val, test = train_test_split(
        rest, train_size=val_share, stratify=rest["label_id"], random_state=RANDOM_SEED
    )
    return {
        "train": train.reset_index(drop=True),
        "val": val.reset_index(drop=True),
        "test": test.reset_index(drop=True),
    }


def verify_files(paths: tuple[Path, Path] = (TRUE_CSV, FAKE_CSV)) -> bool:
    return all(p.exists() for p in paths)


def label_name(idx: int) -> str:
    return INT_TO_LABEL[int(idx)]
