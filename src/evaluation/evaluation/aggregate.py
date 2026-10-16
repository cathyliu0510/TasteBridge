"""Turn two readers' scores into one shared list.

average       (fit_a + fit_b) / 2         same rule as the backend API
least_misery  min(fit_a, fit_b)           same rule as the backend API
merged_seeds  score all ten favorites as one reader (proposal's comparison baseline)

Every favorite of either reader is excluded. Least-misery ties are broken
by the average fit, then catalogue order. Without that, a sparse model
such as item-kNN gives most works a minimum of exactly 0, and the "top"
of the list becomes whatever comes first in the catalogue.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from evaluation.models import Recommender

AGGREGATIONS = ("average", "least_misery", "merged_seeds")


def combined_scores(
    model: Recommender, favorites_a: Sequence[str], favorites_b: Sequence[str], aggregation: str
) -> tuple[np.ndarray, np.ndarray]:
    """(primary score, tie-break score) for every catalogue work."""
    if aggregation == "merged_seeds":
        merged = model.score(list(favorites_a) + list(favorites_b))
        return merged, merged
    fit_a, fit_b = model.score(favorites_a), model.score(favorites_b)
    average = (fit_a + fit_b) / 2
    if aggregation == "average":
        return average, average
    if aggregation == "least_misery":
        return np.minimum(fit_a, fit_b), average
    raise ValueError(f"Unknown aggregation: {aggregation}")


def recommend_pair(
    model: Recommender,
    favorites_a: Sequence[str],
    favorites_b: Sequence[str],
    k: int,
    aggregation: str,
) -> list[str]:
    primary, tie_break = combined_scores(model, favorites_a, favorites_b, aggregation)
    excluded = set(favorites_a) | set(favorites_b)
    keep = np.array([work not in excluded for work in model.items], dtype=bool)
    candidates = np.flatnonzero(keep)
    # lexsort uses the last key first: primary, then tie-break, then catalogue position.
    order = np.lexsort((candidates, -tie_break[candidates], -primary[candidates]))[:k]
    return [model.items[i] for i in candidates[order]]
