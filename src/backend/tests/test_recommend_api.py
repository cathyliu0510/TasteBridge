import pytest
from fastapi.testclient import TestClient

from tests.conftest import FANTASY_FIVE, MYSTERY_FIVE


def post(client: TestClient, **overrides: object):
    payload = {"reader_a": FANTASY_FIVE, "reader_b": MYSTERY_FIVE, **overrides}
    return client.post("/recommend", json=payload)


def test_recommend_returns_five_ranked_bridges_by_default(client: TestClient) -> None:
    response = post(client)

    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "sample-shelf-toy-v1"
    assert body["aggregation"] == "least_misery"
    recs = body["recommendations"]
    assert [r["rank"] for r in recs] == [1, 2, 3, 4, 5]
    scores = [r["score"] for r in recs]
    assert scores == sorted(scores, reverse=True)


def test_least_misery_score_is_the_lower_fit(client: TestClient) -> None:
    for rec in post(client).json()["recommendations"]:
        assert rec["score"] == pytest.approx(min(rec["fit_a"], rec["fit_b"]), abs=1e-4)


def test_average_score_is_the_mean_fit(client: TestClient) -> None:
    body = post(client, aggregation="average").json()

    assert body["aggregation"] == "average"
    for rec in body["recommendations"]:
        assert rec["score"] == pytest.approx((rec["fit_a"] + rec["fit_b"]) / 2, abs=1e-4)


def test_seed_books_are_never_recommended(client: TestClient) -> None:
    body = post(client, k=20).json()

    recommended = {r["book"]["book_id"] for r in body["recommendations"]}
    assert len(body["recommendations"]) == 20
    assert recommended.isdisjoint(FANTASY_FIVE + MYSTERY_FIVE)


def test_reasons_name_one_of_the_readers_own_picks(client: TestClient) -> None:
    for rec in post(client).json()["recommendations"]:
        for reader, seeds in (("reader_a", FANTASY_FIVE), ("reader_b", MYSTERY_FIVE)):
            reason = rec["reasons"][reader]
            assert reason["seed_id"] in seeds
            seed_title = client.get(f"/books/{reason['seed_id']}").json()["title"]
            assert reason["seed_title"] == seed_title
            assert reason["text"].startswith(f"Closest to your pick {seed_title}")
            assert set(reason["shared_shelves"]) <= set(rec["book"]["shelves"])
            assert len(reason["shared_shelves"]) <= 3
            assert isinstance(reason["same_author"], bool)


def test_frontend_spelling_least_misery_is_accepted(client: TestClient) -> None:
    response = post(client, aggregation="least-misery")

    assert response.status_code == 200
    assert response.json()["aggregation"] == "least_misery"


def test_response_includes_each_readers_top_shelves(client: TestClient) -> None:
    top = post(client).json()["top_shelves"]

    assert top["reader_a"][0] == "fantasy"
    assert top["reader_b"][0] == "mystery"
    assert 1 <= len(top["reader_a"]) <= 3
    assert 1 <= len(top["reader_b"]) <= 3


def test_books_carry_a_year_field(client: TestClient) -> None:
    rec_book = post(client).json()["recommendations"][0]["book"]

    assert "year" in rec_book
    assert rec_book["year"] is None or isinstance(rec_book["year"], int)


def test_galaxy_contains_seeds_and_bridges_with_positions(client: TestClient) -> None:
    body = post(client).json()
    galaxy = body["galaxy"]

    assert [p["book_id"] for p in galaxy["reader_a"]] == FANTASY_FIVE
    assert [p["book_id"] for p in galaxy["reader_b"]] == MYSTERY_FIVE
    assert [p["book_id"] for p in galaxy["bridges"]] == [
        r["book"]["book_id"] for r in body["recommendations"]
    ]
    first = body["recommendations"][0]
    assert galaxy["bridges"][0]["x"] == first["position"]["x"]


def test_fewer_than_five_seeds_and_shared_seed_are_allowed(client: TestClient) -> None:
    response = post(client, reader_a=["w_1001"], reader_b=["w_1001", "w_2001"], k=3)

    assert response.status_code == 200
    assert len(response.json()["recommendations"]) == 3


@pytest.mark.parametrize(
    "overrides",
    [
        {"reader_a": []},
        {"reader_a": FANTASY_FIVE + ["w_1006"]},
        {"reader_b": ["w_2001", "w_2001"]},
        {"aggregation": "max_pleasure"},
        {"aggregation": "Least-Misery"},
        {"k": 0},
        {"k": 21},
        {"unexpected": True},
    ],
)
def test_recommend_rejects_malformed_requests(client: TestClient, overrides: dict) -> None:
    assert post(client, **overrides).status_code == 422


def test_recommend_lists_every_unknown_book_id(client: TestClient) -> None:
    response = post(client, reader_a=["w_1001", "nope_1"], reader_b=["nope_2", "w_2001"])

    assert response.status_code == 404
    assert response.json()["detail"]["unknown_ids"] == ["nope_1", "nope_2"]
