import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.feedback import FeedbackStore

VOTE = {"book_id": "w_3001", "vote": "would_read", "model_version": "sample-shelf-toy-v1"}


def test_feedback_stores_only_the_allowed_fields(client: TestClient, feedback_path: Path) -> None:
    response = client.post("/feedback", json=VOTE)

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    [line] = feedback_path.read_text(encoding="utf-8").splitlines()
    record = json.loads(line)
    assert set(record) == {"book_id", "vote", "model_version", "timestamp"}
    assert record["vote"] == "would_read"


def test_feedback_appends_one_line_per_vote(client: TestClient, feedback_path: Path) -> None:
    client.post("/feedback", json=VOTE)
    client.post("/feedback", json={**VOTE, "vote": "not_for_us"})

    assert len(feedback_path.read_text(encoding="utf-8").splitlines()) == 2


def test_feedback_rejects_bad_vote(client: TestClient) -> None:
    assert client.post("/feedback", json={**VOTE, "vote": "meh"}).status_code == 422


def test_feedback_rejects_extra_fields_such_as_names(client: TestClient) -> None:
    assert client.post("/feedback", json={**VOTE, "name": "Ada"}).status_code == 422


def test_feedback_for_unknown_book_returns_404(client: TestClient) -> None:
    assert client.post("/feedback", json={**VOTE, "book_id": "w_9999"}).status_code == 404


def test_feedback_storage_failure_returns_503(client: TestClient, monkeypatch) -> None:
    def broken_open(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(Path, "open", broken_open)

    response = client.post("/feedback", json=VOTE)

    assert response.status_code == 503
    assert "try again" in response.json()["detail"]


def test_feedback_store_creates_missing_directories(tmp_path: Path) -> None:
    path = tmp_path / "a" / "b" / "votes.jsonl"

    FeedbackStore(path).record("w_1", "would_read", "v1")

    assert path.is_file()
