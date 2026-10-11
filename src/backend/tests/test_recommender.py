import time

import numpy as np
import pytest

from app.explanations import build_reason, closest_seed_row, top_shelves
from app.recommender import combine, rank_bridges, taste_vector
from app.schemas import Book

LATENCY_BUDGET_SECONDS = 0.5


def unit_rows(matrix: np.ndarray) -> np.ndarray:
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def test_taste_vector_is_unit_length_mean() -> None:
    embeddings = np.array([[1.0, 0.0], [0.0, 1.0]])

    vector = taste_vector(embeddings, [0, 1])

    np.testing.assert_allclose(vector, [np.sqrt(0.5), np.sqrt(0.5)])


def test_taste_vector_of_opposite_books_is_zero_not_nan() -> None:
    vector = taste_vector(np.array([[1.0, 0.0], [-1.0, 0.0]]), [0, 1])

    assert np.all(np.isfinite(vector))


def test_combine_aggregations() -> None:
    fit_a, fit_b = np.array([0.9, 0.2]), np.array([0.1, 0.6])

    np.testing.assert_allclose(combine(fit_a, fit_b, "least_misery"), [0.1, 0.2])
    np.testing.assert_allclose(combine(fit_a, fit_b, "average"), [0.5, 0.4])
    with pytest.raises(ValueError):
        combine(fit_a, fit_b, "max")  # type: ignore[arg-type]


def test_least_misery_prefers_the_balanced_book() -> None:
    # rows: 0 = reader A seed, 1 = reader B seed, 2 = loved by A only, 3 = between both
    embeddings = unit_rows(np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 0.05], [1.0, 1.0]]))

    ranked = rank_bridges(embeddings, [0], [1], k=2, aggregation="least_misery")

    assert [item.row for item in ranked] == [3, 2]


def test_rank_bridges_returns_fewer_than_k_when_catalogue_is_small() -> None:
    embeddings = unit_rows(np.eye(3) + 0.1)

    ranked = rank_bridges(embeddings, [0], [1], k=10, aggregation="average")

    assert [item.row for item in ranked] == [2]


def test_recommend_meets_latency_budget_for_5000_books() -> None:
    embeddings = unit_rows(np.random.default_rng(0).normal(size=(5000, 64)).astype(np.float32))

    start = time.perf_counter()
    rank_bridges(embeddings, [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], k=5, aggregation="least_misery")

    assert time.perf_counter() - start < LATENCY_BUDGET_SECONDS


def book(book_id: str, author: str, shelves: tuple[str, ...]) -> Book:
    return Book(book_id=book_id, title=f"Title {book_id}", author=author, shelves=shelves)


def test_closest_seed_row_picks_most_similar_seed() -> None:
    embeddings = unit_rows(np.array([[1.0, 0.0], [0.0, 1.0], [0.9, 0.1]]))

    assert closest_seed_row(embeddings, target_row=2, seed_rows=[1, 0]) == 0


def test_reason_mentions_seed_author_and_at_most_three_shelves() -> None:
    seed = book("s", "Neil Gaiman", ("fantasy", "dark", "mythology", "adventure"))
    rec = book("r", "Neil Gaiman", ("adventure", "fantasy", "dark", "mythology", "urban"))

    reason = build_reason(rec, seed, [seed])

    assert reason.seed_id == "s"
    assert reason.seed_title == "Title s"
    assert reason.same_author is True
    assert reason.shared_shelves == ("adventure", "fantasy", "dark")
    assert reason.text == (
        "Closest to your pick Title s; same author as one of your picks: Neil Gaiman; "
        "shared shelves: adventure, fantasy, dark."
    )


def test_reason_without_shared_metadata_names_only_the_seed() -> None:
    seed = book("s", "A", ("mystery",))

    reason = build_reason(book("r", "B", ("fantasy",)), seed, [seed])

    assert reason.same_author is False
    assert reason.shared_shelves == ()
    assert reason.text == "Closest to your pick Title s."


def test_same_author_is_detected_from_any_pick_not_only_the_closest() -> None:
    closest = book("s1", "A", ("fantasy",))
    other = book("s2", "Neil Gaiman", ("mystery",))

    reason = build_reason(book("r", "Neil Gaiman", ("fantasy",)), closest, [closest, other])

    assert reason.same_author is True
    assert reason.seed_id == "s1"


def test_top_shelves_ranks_by_count_then_first_appearance() -> None:
    picks = [
        book("1", "A", ("fantasy", "magic", "adventure")),
        book("2", "B", ("mystery", "fantasy")),
        book("3", "C", ("magic", "dark", "fantasy")),
    ]

    assert top_shelves(picks) == ("fantasy", "magic", "adventure")


def test_top_shelves_of_books_without_shelves_is_empty() -> None:
    assert top_shelves([book("1", "A", ())]) == ()
