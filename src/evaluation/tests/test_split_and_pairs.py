"""User split, simulated readers and genre-labelled pairs."""

import pandas as pd
import pytest

from evaluation.pairs import genre_profiles, sample_pairs
from evaluation.split import EvalReader, make_eval_readers, split_users


def test_split_is_disjoint_complete_and_close_to_80_10_10() -> None:
    users = [f"u{i}" for i in range(1000)]
    split = split_users(users, seed=1)
    assert not (split.train & split.tune or split.train & split.test or split.tune & split.test)
    assert split.train | split.tune | split.test == set(users)
    assert (len(split.train), len(split.tune), len(split.test)) == (800, 100, 100)


def test_split_is_deterministic_and_ignores_input_order() -> None:
    users = [f"u{i}" for i in range(50)]
    assert split_users(users, seed=3) == split_users(list(reversed(users)), seed=3)
    assert split_users(users, seed=3) != split_users(users, seed=4)


def test_split_rejects_bad_fractions() -> None:
    with pytest.raises(ValueError):
        split_users(["a", "b"], fractions=(0.5, 0.5, 0.5))


def likes_table(counts: dict[str, int], rating: int = 5) -> pd.DataFrame:
    rows = [(u, f"w{i}", rating) for u, n in counts.items() for i in range(n)]
    return pd.DataFrame(rows, columns=["user_id", "work_id", "rating"])


def test_readers_need_15_likes_and_favorites_are_not_hidden() -> None:
    frame = likes_table({"enough": 15, "short": 14})
    readers = make_eval_readers(frame, users={"enough", "short"}, catalogue={f"w{i}" for i in range(20)})
    assert [r.user_id for r in readers] == ["enough"]
    (reader,) = readers
    assert len(reader.favorites) == 5 and len(reader.hidden) == 10
    assert not set(reader.favorites) & reader.hidden


def test_low_ratings_and_unrecommendable_works_do_not_count_as_likes() -> None:
    frame = pd.concat([likes_table({"u": 10}), likes_table({"u": 20}, rating=3)])
    assert make_eval_readers(frame, {"u"}, catalogue={f"w{i}" for i in range(30)}) == []
    frame = likes_table({"u": 20})
    assert make_eval_readers(frame, {"u"}, catalogue={f"w{i}" for i in range(12)}) == []


def test_only_requested_users_are_evaluated() -> None:
    frame = likes_table({"test_user": 20, "train_user": 20})
    readers = make_eval_readers(frame, {"test_user"}, catalogue={f"w{i}" for i in range(20)})
    assert [r.user_id for r in readers] == ["test_user"]


def test_fewer_favorites_keep_the_same_hidden_set() -> None:
    reader = EvalReader("u", ("a", "b", "c", "d", "e"), frozenset({"x", "y"}))
    two = reader.with_favorites(2)
    assert two.favorites == ("a", "b") and two.hidden == reader.hidden
    with pytest.raises(ValueError):
        reader.with_favorites(0)


GENRES = {"f1": ["fantasy"], "f2": ["fantasy"], "m1": ["mystery"], "m2": ["mystery"], "x": ["fantasy", "mystery"]}


def reader(name: str, favorites: tuple[str, ...]) -> EvalReader:
    return EvalReader(name, favorites, frozenset({"hidden"}))


def test_genre_profiles_are_unit_vectors_of_favorite_genres() -> None:
    profiles = genre_profiles([reader("a", ("f1", "f2")), reader("b", ("x",))], GENRES)
    assert profiles[0].tolist() == [1.0, 0.0]  # columns: fantasy, mystery
    assert profiles[1] == pytest.approx([2**-0.5, 2**-0.5])


def test_pairs_are_balanced_and_similar_pairs_are_more_similar() -> None:
    readers = [reader(f"f{i}", ("f1", "f2")) for i in range(6)] + [reader(f"m{i}", ("m1", "m2")) for i in range(6)]
    pairs = sample_pairs(readers, GENRES, n_pairs=10, seed=0)
    kinds = [p.kind for p in pairs]
    assert kinds.count("similar") == 5 and kinds.count("different") == 5
    assert min(p.genre_similarity for p in pairs if p.kind == "similar") > max(
        p.genre_similarity for p in pairs if p.kind == "different"
    )
    assert all(p.a.user_id != p.b.user_id for p in pairs)
    assert len({(p.a.user_id, p.b.user_id) for p in pairs}) == len(pairs)


def test_pairs_are_deterministic_given_a_seed() -> None:
    readers = [reader(f"r{i}", (("f1",), ("m1",), ("x",))[i % 3]) for i in range(30)]
    first = [(p.a.user_id, p.b.user_id) for p in sample_pairs(readers, GENRES, 20, seed=7)]
    again = [(p.a.user_id, p.b.user_id) for p in sample_pairs(readers, GENRES, 20, seed=7)]
    assert first == again


def test_too_few_readers_is_an_error() -> None:
    with pytest.raises(ValueError):
        sample_pairs([reader("a", ("f1",)), reader("b", ("m1",))], GENRES, n_pairs=2)
