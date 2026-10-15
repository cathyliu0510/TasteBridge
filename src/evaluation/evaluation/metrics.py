"""Ranking metrics from the MS1 proposal.

Primary
    Min-Recall@k: the lower of the two readers' Recall@k. A list only scores
    well if it serves both readers, not just the easier one.
Secondary
    mean NDCG@k over the two readers; long-tail coverage.
Supplementary
    Both-Hit@k: whether the list contains a work hidden for *both* readers.
    Only defined when the hidden sets overlap, which is uncommon, so the
    share of eligible pairs is reported alongside it.

Relevance is binary: a recommended work is relevant to a reader if it is
in that reader's hidden likes.
"""

from __future__ import annotations

from collections.abc import Collection, Iterable, Mapping, Sequence

import numpy as np

K = 10
HEAD_SHARE = 0.2  # works in the top 20% by training popularity are the "head"


def recall_at_k(ranked: Sequence[str], relevant: Collection[str], k: int = K) -> float:
    if not relevant:
        raise ValueError("relevant set is empty; Recall@k is undefined")
    hits = sum(1 for work in ranked[:k] if work in relevant)
    return hits / len(relevant)


def ndcg_at_k(ranked: Sequence[str], relevant: Collection[str], k: int = K) -> float:
    if not relevant:
        raise ValueError("relevant set is empty; NDCG@k is undefined")
    dcg = sum(1 / np.log2(rank + 2) for rank, work in enumerate(ranked[:k]) if work in relevant)
    ideal = sum(1 / np.log2(rank + 2) for rank in range(min(len(relevant), k)))
    return float(dcg / ideal)


def both_hit_at_k(
    ranked: Sequence[str], hidden_a: Collection[str], hidden_b: Collection[str], k: int = K
) -> bool | None:
    """None when the readers share no hidden like (pair not eligible)."""
    shared = set(hidden_a) & set(hidden_b)
    if not shared:
        return None
    return any(work in shared for work in ranked[:k])


def pair_metrics(
    ranked: Sequence[str], hidden_a: Collection[str], hidden_b: Collection[str], k: int = K
) -> dict[str, float | bool | None]:
    recall_a = recall_at_k(ranked, hidden_a, k)
    recall_b = recall_at_k(ranked, hidden_b, k)
    return {
        "recall_a": recall_a,
        "recall_b": recall_b,
        "min_recall": min(recall_a, recall_b),
        "mean_ndcg": (ndcg_at_k(ranked, hidden_a, k) + ndcg_at_k(ranked, hidden_b, k)) / 2,
        "both_hit": both_hit_at_k(ranked, hidden_a, hidden_b, k),
    }


def long_tail(popularity: Mapping[str, int], head_share: float = HEAD_SHARE) -> frozenset[str]:
    """Works outside the most popular `head_share` of the catalogue (ties by work ID)."""
    ordered = sorted(popularity, key=lambda work: (-popularity[work], work))
    n_head = int(np.ceil(head_share * len(ordered)))
    return frozenset(ordered[n_head:])


def coverage(
    lists: Iterable[Sequence[str]], catalogue: Collection[str], tail: Collection[str]
) -> dict[str, float]:
    """Catalogue coverage, long-tail coverage and the tail share of all slots."""
    lists = [list(items) for items in lists]
    recommended = {work for items in lists for work in items}
    slots = sum(len(items) for items in lists)
    tail = set(tail)
    return {
        "catalogue_coverage": len(recommended) / len(catalogue) if catalogue else 0.0,
        "long_tail_coverage": len(recommended & tail) / len(tail) if tail else 0.0,
        "long_tail_share": (
            sum(1 for items in lists for work in items if work in tail) / slots if slots else 0.0
        ),
    }
