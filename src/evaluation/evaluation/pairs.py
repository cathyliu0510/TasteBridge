"""Simulated reader pairs, labelled by genre metadata only.

A reader's genre profile is the normalised genre count over their five
favorites, which is all the app sees. Pair similarity is the cosine of the
two profiles. From a pool of random candidate pairs, the most similar
quartile becomes "similar" and the least similar quartile "different";
half of the returned pairs come from each. Model outputs are never used,
so pair labels cannot favour any model.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

import numpy as np

from evaluation.split import EvalReader

PairKind = Literal["similar", "different"]
CANDIDATES_PER_PAIR = 20
QUARTILE = 0.25


@dataclass(frozen=True)
class ReaderPair:
    a: EvalReader
    b: EvalReader
    genre_similarity: float
    kind: PairKind


def genre_profiles(
    readers: Sequence[EvalReader], book_genres: Mapping[str, Sequence[str]]
) -> np.ndarray:
    genres = sorted({g for r in readers for w in r.favorites for g in book_genres.get(w, ())})
    column = {g: i for i, g in enumerate(genres)}
    profiles = np.zeros((len(readers), max(len(genres), 1)))
    for row, reader in enumerate(readers):
        for work in reader.favorites:
            for genre in book_genres.get(work, ()):
                profiles[row, column[genre]] += 1
    norms = np.linalg.norm(profiles, axis=1, keepdims=True)
    return np.divide(profiles, norms, out=np.zeros_like(profiles), where=norms > 0)


def _candidate_pairs(n_readers: int, n_candidates: int, rng: np.random.Generator) -> np.ndarray:
    total = n_readers * (n_readers - 1) // 2
    if n_candidates >= total:
        i, j = np.triu_indices(n_readers, k=1)
        return np.stack([i, j], axis=1)
    seen: set[tuple[int, int]] = set()
    while len(seen) < n_candidates:
        i, j = rng.integers(0, n_readers, size=2)
        if i != j:
            seen.add((min(i, j), max(i, j)))
    return np.array(sorted(seen))


def sample_pairs(
    readers: Sequence[EvalReader],
    book_genres: Mapping[str, Sequence[str]],
    n_pairs: int,
    seed: int = 0,
) -> list[ReaderPair]:
    """n_pairs pairs: about half "similar", half "different"."""
    if len(readers) < 4:
        raise ValueError(f"Need at least 4 eligible readers to build pairs, got {len(readers)}")
    if n_pairs < 2:
        raise ValueError("n_pairs must be at least 2")
    rng = np.random.default_rng(seed)
    profiles = genre_profiles(readers, book_genres)
    candidates = _candidate_pairs(len(readers), CANDIDATES_PER_PAIR * n_pairs, rng)
    similarity = np.einsum("ij,ij->i", profiles[candidates[:, 0]], profiles[candidates[:, 1]])

    # Stable order so ties are broken by candidate order, which is seeded.
    order = np.argsort(similarity, kind="stable")
    quartile = max(1, int(len(order) * QUARTILE))
    pools: dict[PairKind, np.ndarray] = {"different": order[:quartile], "similar": order[-quartile:]}

    pairs: list[ReaderPair] = []
    for kind, want in (("similar", n_pairs - n_pairs // 2), ("different", n_pairs // 2)):
        pool = pools[kind]
        picked = rng.choice(pool, size=min(want, len(pool)), replace=False)
        for idx in sorted(picked):
            i, j = candidates[idx]
            pairs.append(ReaderPair(readers[i], readers[j], float(similarity[idx]), kind))
    return pairs
