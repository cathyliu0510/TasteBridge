"""Two-reader ranking (SPEC.md 4.4, 'Algorithm').

Pure numpy functions: they take row indices into the artifact matrices and
never modify their inputs.
"""

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from app.schemas import Aggregation


@dataclass(frozen=True)
class ScoredBook:
    row: int
    score: float
    fit_a: float
    fit_b: float


def taste_vector(embeddings: np.ndarray, rows: Sequence[int]) -> np.ndarray:
    """Mean of the reader's book embeddings, scaled to unit length."""
    mean = embeddings[list(rows)].mean(axis=0)
    norm = np.linalg.norm(mean)
    return mean / norm if norm > 0 else mean


def combine(fit_a: np.ndarray, fit_b: np.ndarray, aggregation: Aggregation) -> np.ndarray:
    if aggregation == "average":
        return (fit_a + fit_b) / 2
    if aggregation == "least_misery":
        return np.minimum(fit_a, fit_b)
    raise ValueError(f"Unknown aggregation: {aggregation}")


def rank_bridges(
    embeddings: np.ndarray,
    rows_a: Sequence[int],
    rows_b: Sequence[int],
    k: int,
    aggregation: Aggregation,
) -> list[ScoredBook]:
    """Top-k catalogue books for both readers, excluding every seed book.

    `embeddings` rows must already be L2-normalised, so a dot product is
    the cosine similarity.
    """
    fit_a = embeddings @ taste_vector(embeddings, rows_a)
    fit_b = embeddings @ taste_vector(embeddings, rows_b)
    scores = combine(fit_a, fit_b, aggregation)

    candidates = np.ones(len(scores), dtype=bool)
    candidates[list(rows_a)] = False
    candidates[list(rows_b)] = False
    candidate_rows = np.flatnonzero(candidates)

    order = np.argsort(-scores[candidate_rows], kind="stable")[:k]
    return [
        ScoredBook(
            row=int(row),
            score=float(scores[row]),
            fit_a=float(fit_a[row]),
            fit_b=float(fit_b[row]),
        )
        for row in candidate_rows[order]
    ]
