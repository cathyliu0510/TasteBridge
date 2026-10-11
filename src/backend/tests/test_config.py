import pytest

from app.config import Settings


def test_cors_origins_parsed_from_comma_list(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")

    assert Settings.from_env().cors_origins == ("http://a.test", "http://b.test")


@pytest.mark.parametrize("value", ["", " , "])
def test_empty_cors_origins_fail_fast(monkeypatch, value: str) -> None:
    monkeypatch.setenv("CORS_ORIGINS", value)

    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings.from_env()
