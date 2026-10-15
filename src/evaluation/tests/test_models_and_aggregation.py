"""Reference baselines and two-reader aggregation."""

import numpy as np
import pandas as pd
import pytest

from evaluation.aggregate import recommend_pair
from evaluation.models import ItemKNN, Popularity


def interactions(rows: list[tuple[str, str, int]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["user_id", "work_id", "rating"])


# u1-u3 like a+b together; u4-u5 like c+d together; everyone likes p.
CO_LIKES = interactions(
    [(u, w, 5) for u in ("u1", "u2", "u3") for w in ("a", "b", "p")]
    + [(u, w, 5) for u in ("u4", "u5") for w in ("c", "d", "p")]
    + [("u6", "p", 5), ("u6", "z", 2)]  # z is never liked: not in the catalogue
)


def test_popularity_counts_likes_only_and_is_scaled() -> None:
    model = Popularity().fit(CO_LIKES)
    scores = dict(zip(model.items, model.score(["a"])))
    assert "z" not in scores
    assert scores["p"] == 1.0
    assert scores["a"] == pytest.approx(3 / 6)


def test_item_knn_finds_co_liked_work() -> None:
    model = ItemKNN().fit(CO_LIKES)
    assert recommend_pair(model, ["a"], ["a"], k=1, aggregation="average") == ["b"]
    assert recommend_pair(model, ["c"], ["c"], k=1, aggregation="average") == ["d"]


def test_item_knn_scores_are_in_unit_range_and_unknown_favorites_are_ignored() -> None:
    model = ItemKNN().fit(CO_LIKES)
    scores = model.score(["a", "not-in-catalogue"])
    assert scores.max() == pytest.approx(1.0) and scores.min() >= 0
    assert np.all(model.score(["not-in-catalogue"]) == 0)


def test_item_knn_neighbour_pruning_keeps_the_strongest() -> None:
    model = ItemKNN(n_neighbors=1).fit(CO_LIKES)
    a_row = model.score(["a"])
    assert dict(zip(model.items, a_row))["b"] == 1.0
    assert np.count_nonzero(a_row) == 1


class FixedScores:
    """Hand-set fits so aggregation can be checked exactly."""

    name = "fixed"
    items = ("both_ok", "a_loves", "b_loves", "seed_a", "seed_b")
    fits = {
        "A": np.array([0.6, 1.0, 0.1, 0.9, 0.0]),
        "B": np.array([0.6, 0.1, 1.0, 0.0, 0.9]),
    }

    def fit(self, interactions):  # pragma: no cover - not needed
        return self

    def score(self, favorites):
        return self.fits["A"] if "seed_a" in favorites and "seed_b" not in favorites else (
            self.fits["B"] if "seed_b" in favorites and "seed_a" not in favorites else self.fits["A"] + self.fits["B"]
        )


def test_least_misery_prefers_the_work_both_readers_tolerate() -> None:
    top = recommend_pair(FixedScores(), ["seed_a"], ["seed_b"], k=3, aggregation="least_misery")
    assert top[0] == "both_ok"


def test_favorites_of_either_reader_are_never_recommended() -> None:
    for aggregation in ("average", "least_misery", "merged_seeds"):
        top = recommend_pair(FixedScores(), ["seed_a"], ["seed_b"], k=5, aggregation=aggregation)
        assert not {"seed_a", "seed_b"} & set(top)
        assert len(top) == 3


def test_least_misery_ties_at_zero_fall_back_to_average_not_catalogue_order() -> None:
    class Disjoint(FixedScores):
        items = ("filler", "a_strong", "seed_a", "seed_b")
        fits = {"A": np.array([0.0, 0.9, 1.0, 0.0]), "B": np.array([0.1, 0.0, 0.0, 1.0])}

    # min() is 0 for both candidates; the average (0.45 vs 0.05) must decide.
    assert recommend_pair(Disjoint(), ["seed_a"], ["seed_b"], k=1, aggregation="least_misery") == ["a_strong"]


def test_unknown_aggregation_is_an_error() -> None:
    with pytest.raises(ValueError):
        recommend_pair(FixedScores(), ["seed_a"], ["seed_b"], k=1, aggregation="max")
