"""User-level 80/10/10 split and simulated test readers.

Splitting by user (not by interaction) means no test reader's history is
ever seen during training. Each evaluated reader needs at least
MIN_LIKES liked works: N_FAVORITES become the "five favorites" the app
asks for, and every other like is hidden and must be recovered.
"""

from __future__ import annotations

from collections.abc import Collection, Iterable
from dataclasses import dataclass

import numpy as np
import pandas as pd

from evaluation.data import likes

SPLIT_FRACTIONS = (0.8, 0.1, 0.1)
MIN_LIKES = 15
N_FAVORITES = 5


@dataclass(frozen=True)
class UserSplit:
    train: frozenset[str]
    tune: frozenset[str]
    test: frozenset[str]

    def users(self, name: str) -> frozenset[str]:
        if name not in ("train", "tune", "test"):
            raise ValueError(f"Unknown split: {name}")
        return getattr(self, name)


def split_users(
    user_ids: Iterable[str],
    fractions: tuple[float, float, float] = SPLIT_FRACTIONS,
    seed: int = 0,
) -> UserSplit:
    if len(fractions) != 3 or any(f < 0 for f in fractions) or not np.isclose(sum(fractions), 1):
        raise ValueError(f"fractions must be three non-negative numbers summing to 1: {fractions}")
    users = np.array(sorted(set(map(str, user_ids))), dtype=object)
    order = np.random.default_rng(seed).permutation(len(users))
    users = users[order]
    n_train = int(round(fractions[0] * len(users)))
    n_tune = int(round(fractions[1] * len(users)))
    return UserSplit(
        train=frozenset(users[:n_train]),
        tune=frozenset(users[n_train : n_train + n_tune]),
        test=frozenset(users[n_train + n_tune :]),
    )


@dataclass(frozen=True)
class EvalReader:
    user_id: str
    favorites: tuple[str, ...]  # N_FAVORITES works, in selection order
    hidden: frozenset[str]  # every other liked work

    def with_favorites(self, n: int) -> "EvalReader":
        """Same hidden set with only the first n favorites (robustness: 1-5 inputs)."""
        if not 1 <= n <= len(self.favorites):
            raise ValueError(f"n must be between 1 and {len(self.favorites)}: {n}")
        return EvalReader(self.user_id, self.favorites[:n], self.hidden)


def make_eval_readers(
    interactions: pd.DataFrame,
    users: Collection[str],
    catalogue: Collection[str],
    min_likes: int = MIN_LIKES,
    n_favorites: int = N_FAVORITES,
    seed: int = 0,
) -> list[EvalReader]:
    """Readers from `users` with enough likes among works the models can recommend.

    Works outside `catalogue` (never liked by a training user) cannot be
    recommended by any model, so they are dropped before counting likes.
    """
    if min_likes <= n_favorites:
        raise ValueError("min_likes must exceed n_favorites so every reader has hidden likes")
    catalogue = set(catalogue)
    liked = likes(interactions)
    liked = liked[liked["user_id"].isin(set(users)) & liked["work_id"].isin(catalogue)]
    rng = np.random.default_rng(seed)
    readers = []
    for user_id, group in liked.groupby("user_id", sort=True):
        works = sorted(group["work_id"])
        if len(works) < min_likes:
            continue
        chosen = rng.choice(len(works), size=n_favorites, replace=False)
        favorites = tuple(works[i] for i in chosen)
        readers.append(EvalReader(str(user_id), favorites, frozenset(works) - set(favorites)))
    return readers
