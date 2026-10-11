import logging

from fastapi.testclient import TestClient


def test_every_request_logs_method_path_status_and_duration(client: TestClient, caplog) -> None:
    with caplog.at_level(logging.INFO, logger="tastebridge.requests"):
        client.get("/books/w_9999")

    [message] = [r.getMessage() for r in caplog.records if r.name == "tastebridge.requests"]
    method, path, status, duration = message.split()
    assert (method, path, status) == ("GET", "/books/w_9999", "404")
    assert duration.endswith("ms")
