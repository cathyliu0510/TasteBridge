"""Book-quality checks for the preprocess stage: description flags and shelf cleaning.

Owner: YiTong Li. Preprocess calls this once, after work-level grouping and
before writing data/processed/books.parquet:

    books, quality_summary = add_quality_flags(books)

Column definitions and examples: doc/quality-columns.md (YiTong's notes) and
spec.md section 8.
"""

from __future__ import annotations

import html
import math
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


# ---------------------------------------------------------------------- shelves
# Bump SHELF_RULES_VERSION whenever the lists below change; it is recorded in
# manifest.json so a data version says which shelf rules produced it.
SHELF_RULES_VERSION = "2026-10-12.1"

# Shelves about the reader (status, format, ownership), not the book.
# "fiction", "novels" and "favorites" are blocked on purpose: in a fantasy/mystery
# catalogue they carry no information and would make useless explanation reasons.
SHELF_BLOCKLIST = frozenset(
    {
        "to-read", "currently-reading", "read", "owned", "own", "books-i-own",
        "i-own", "owned-books", "my-books", "kindle", "ebook", "ebooks", "e-book",
        "audiobook", "audiobooks", "audible", "library", "favorites", "default",
        "wishlist", "wish-list", "tbr", "to-buy", "dnf", "did-not-finish",
        "abandoned", "on-hold", "re-read", "books", "book-club", "maybe",
        "fiction", "novels",
    }
)

SHELF_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"^\d{4}$",                         # 2015
        r"^read-in-\d{4}$",                 # read-in-2016
        r"^\d{4}-reads?$",                  # 2017-reads
        r"^read-\d{4}$",                    # read-2018
        r"^\d(-|\.)?stars?$",               # 5-stars, 4stars
        r"^(to-read|owned|kindle|tbr)-",    # to-read-fantasy, owned-hardcover
    )
)

# Small and explicit on purpose: only spellings we have seen for the same idea.
SHELF_SYNONYMS = {
    "sci-fi": "science-fiction",
    "scifi": "science-fiction",
    "ya": "young-adult",
    "favourites": "favorites",
}

_SEP = re.compile(r"[\s_]+")
_DASHES = re.compile(r"-{2,}")


def normalize_shelf(name: object) -> str:
    """Lowercase, spaces/underscores to '-', collapse dashes, apply synonyms."""
    shelf = _SEP.sub("-", str(name).strip().lower())
    shelf = _DASHES.sub("-", shelf).strip("-")
    return SHELF_SYNONYMS.get(shelf, shelf)


def is_generic_shelf(name: object) -> bool:
    """True if the shelf describes the reader rather than the book."""
    shelf = normalize_shelf(name)
    return shelf in SHELF_BLOCKLIST or any(p.search(shelf) for p in SHELF_PATTERNS)


def _parse_count(raw: object) -> float | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, np.integer)):
        return float(raw)
    if isinstance(raw, float) and not math.isnan(raw):
        return raw
    if isinstance(raw, str):
        digits = raw.replace(",", "").strip()
        if digits.isdigit():
            return float(digits)
    return None


def _entries(popular_shelves: object) -> list:
    if _is_missing(popular_shelves):
        return []
    if isinstance(popular_shelves, (str, dict)):
        return [popular_shelves]
    return list(popular_shelves)


def _clean_shelves_with_stats(
    popular_shelves: object, min_count: int, top_n: int
) -> tuple[list[str], int, int]:
    """Return (kept shelves, number of readable entries, number of unreadable entries)."""
    counts: dict[str, float] = {}
    raw_total = 0
    unknown = 0
    for entry in _entries(popular_shelves):
        if isinstance(entry, str):
            name, count = entry, math.inf
        elif isinstance(entry, dict) and isinstance(entry.get("name"), str):
            name, count = entry["name"], _parse_count(entry.get("count"))
            if count is None:
                unknown += 1
                continue
        else:
            unknown += 1
            continue
        raw_total += 1
        shelf = normalize_shelf(name)
        if not shelf or is_generic_shelf(shelf):
            continue
        counts[shelf] = counts.get(shelf, 0.0) + count
    kept = [shelf for shelf, count in counts.items() if count >= min_count]
    kept.sort(key=lambda shelf: -counts[shelf])  # stable sort: ties keep first-seen order
    return kept[:top_n], raw_total, unknown


def clean_shelves(popular_shelves: object, min_count: int = 3, top_n: int = 20) -> list[str]:
    """Clean one book's shelves.

    Accepts the raw Goodreads list [{"name": str, "count": str|int}, ...] or a plain
    list of names (each counted as infinitely popular). Normalizes, drops generic
    shelves, merges duplicates, drops counts below min_count, keeps the top_n.
    """
    kept, _, _ = _clean_shelves_with_stats(popular_shelves, min_count, top_n)
    return kept
