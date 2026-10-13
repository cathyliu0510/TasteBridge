"""Book-quality checks for the preprocess stage: description flags and shelf cleaning.

Owner: YiTong Li. Preprocess calls this once, after work-level grouping and
before writing data/processed/books.parquet:

    books, quality_summary = add_quality_flags(books)

Column definitions and examples: doc/quality-columns.md (YiTong's notes) and
spec.md section 8.
"""

from __future__ import annotations

import html
import re

import numpy as np
import pandas as pd

MIN_DESCRIPTION_CHARS = 40

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _is_missing(value: object) -> bool:
    """True for None, NaN and pandas NA (what parquet returns for empty text)."""
    if value is None:
        return True
    if isinstance(value, (list, tuple, dict, np.ndarray)):
        return False
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def clean_description(text: object) -> str | None:
    """Strip HTML tags, then decode entities, then collapse whitespace.

    Tags go first so escaped text such as "&lt;Series&gt;" survives as "<Series>".
    Returns None when nothing is left.
    """
    if _is_missing(text):
        return None
    cleaned = _TAG.sub(" ", str(text))
    cleaned = html.unescape(cleaned)
    cleaned = _WS.sub(" ", cleaned).strip()
    return cleaned or None


def check_description(
    text: object, min_chars: int = MIN_DESCRIPTION_CHARS
) -> tuple[str | None, str | None]:
    """Return (clean_text, issue); issue is None, "missing" or "too_short".

    Too-short text is kept so a person can still read it; only the flag changes.
    """
    clean = clean_description(text)
    if clean is None:
        return None, "missing"
    if len(clean) < min_chars:
        return clean, "too_short"
    return clean, None
