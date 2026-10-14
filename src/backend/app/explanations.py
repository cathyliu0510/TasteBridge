"""Template reasons built only from picked books, authors and shelf tags.

Per the proposal, reasons never contain invented facts: every phrase comes
straight from the catalogue metadata.
"""

from collections import Counter
from collections.abc import Sequence

import numpy as np

from app.schemas import Book, Reason

MAX_SHARED_SHELVES = 3
MAX_TOP_SHELVES = 3


def closest_seed_row(embeddings: np.ndarray, target_row: int, seed_rows: Sequence[int]) -> int:
    """The reader's own seed book most similar to the recommended book."""
    similarities = embeddings[list(seed_rows)] @ embeddings[target_row]
    return seed_rows[int(np.argmax(similarities))]


def build_reason(recommended: Book, closest_seed: Book, reader_seeds: Sequence[Book]) -> Reason:
    same_author = recommended.author in {seed.author for seed in reader_seeds}
    seed_shelves = set(closest_seed.shelves)
    shared = tuple(
        shelf for shelf in recommended.shelves if shelf in seed_shelves
    )[:MAX_SHARED_SHELVES]

    parts = [f"Closest to your pick {closest_seed.title}"]
    if same_author:
        parts.append(f"same author as one of your picks: {recommended.author}")
    if shared:
        parts.append("shared shelves: " + ", ".join(shared))

    return Reason(
        seed_id=closest_seed.book_id,
        seed_title=closest_seed.title,
        same_author=same_author,
        shared_shelves=shared,
        text="; ".join(parts) + ".",
    )


def top_shelves(picks: Sequence[Book]) -> tuple[str, ...]:
    """A reader's most common shelves; ties keep the order they first appear in."""
    counts = Counter(shelf for book in picks for shelf in book.shelves)
    # Counter keeps insertion order and most_common() sorts stably
    return tuple(shelf for shelf, _ in counts.most_common(MAX_TOP_SHELVES))
