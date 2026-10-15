"""Metric values checked against hand calculations."""

import math

import pytest

from evaluation.metrics import both_hit_at_k, coverage, long_tail, ndcg_at_k, pair_metrics, recall_at_k


def test_recall_counts_hits_in_top_k_over_all_hidden_likes() -> None:
    ranked = ["a", "x", "b", "y", "c"]
    assert recall_at_k(ranked, {"a", "b", "z", "w"}, k=3) == pytest.approx(2 / 4)
    assert recall_at_k(ranked, {"c"}, k=3) == 0.0  # hit at rank 5 is outside k=3


def test_recall_rejects_empty_relevant_set() -> None:
    with pytest.raises(ValueError):
        recall_at_k(["a"], set())


def test_ndcg_hand_example() -> None:
    # hits at ranks 1 and 3; two relevant items
    dcg = 1 / math.log2(2) + 1 / math.log2(4)
    idcg = 1 / math.log2(2) + 1 / math.log2(3)
    assert ndcg_at_k(["a", "x", "b"], {"a", "b"}, k=3) == pytest.approx(dcg / idcg)


def test_ndcg_is_one_for_perfect_ranking_and_zero_for_no_hits() -> None:
    assert ndcg_at_k(["a", "b", "x"], {"a", "b"}, k=3) == pytest.approx(1.0)
    assert ndcg_at_k(["x", "y"], {"a"}, k=2) == 0.0


def test_ndcg_ideal_is_capped_at_k() -> None:
    # 5 relevant items but k=2: two hits at the top is perfect
    assert ndcg_at_k(["a", "b"], {"a", "b", "c", "d", "e"}, k=2) == pytest.approx(1.0)


def test_min_recall_is_the_weaker_reader() -> None:
    m = pair_metrics(["a1", "a2", "b1"], hidden_a={"a1", "a2"}, hidden_b={"b1", "b2", "b3", "b4"}, k=3)
    assert m["recall_a"] == pytest.approx(1.0)
    assert m["recall_b"] == pytest.approx(0.25)
    assert m["min_recall"] == pytest.approx(0.25)


def test_a_list_serving_only_one_reader_scores_zero() -> None:
    m = pair_metrics(["a1", "a2"], hidden_a={"a1", "a2"}, hidden_b={"b1"}, k=2)
    assert m["min_recall"] == 0.0


def test_both_hit_needs_a_work_hidden_for_both() -> None:
    assert both_hit_at_k(["s", "x"], {"s", "a"}, {"s", "b"}, k=2) is True
    assert both_hit_at_k(["a", "b"], {"s", "a"}, {"s", "b"}, k=2) is False
    assert both_hit_at_k(["a", "b"], {"a"}, {"b"}, k=2) is None  # no overlap: not eligible


def test_long_tail_excludes_the_most_popular_fifth() -> None:
    popularity = {f"w{i}": 100 - i for i in range(10)}
    tail = long_tail(popularity, head_share=0.2)
    assert tail == frozenset(f"w{i}" for i in range(2, 10))


def test_long_tail_ties_are_broken_by_work_id() -> None:
    # one head slot; "a" and "b" tie on popularity, so "a" wins by ID
    assert long_tail({"b": 5, "a": 5, "c": 1}, head_share=0.2) == frozenset({"b", "c"})


def test_coverage_counts_distinct_works_and_tail_slots() -> None:
    result = coverage([["h", "t1"], ["h", "t2"]], catalogue={"h", "t1", "t2", "t3"}, tail={"t1", "t2", "t3"})
    assert result["catalogue_coverage"] == pytest.approx(3 / 4)
    assert result["long_tail_coverage"] == pytest.approx(2 / 3)
    assert result["long_tail_share"] == pytest.approx(2 / 4)
