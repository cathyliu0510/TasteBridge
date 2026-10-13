import json

import numpy as np
import pandas as pd
import pytest

from embed.config import Settings
from embed.encoder import EmbeddingError
from embed.inputs import sha256_file
from embed.run import main, run

OUTPUTS = [
    "desc_embeddings.npy", "desc_rows.parquet", "meta.json",
    "retrieval_example.json", "retrieval_example.md", "run.log",
]


def _settings(tmp_path, books_path, **overrides):
    values = dict(
        input_path=books_path,
        output_dir=tmp_path / "embeddings",
        model_name="unused",
        model_revision="unused",
        batch_size=8,
        example_queries=("a heist with a crew of con artists",),
        evidence_excerpts=False,
        code_version="abc123",
    )
    values.update(overrides)
    return Settings(**values)


def test_run_writes_all_outputs(tmp_path, books_path, encoder):
    s = _settings(tmp_path, books_path)
    run(s, encoder=encoder)
    for name in OUTPUTS:
        assert (s.output_dir / name).is_file(), name
    assert (s.output_dir / "chroma").is_dir()
    assert not (tmp_path / "embeddings.tmp").exists()


def test_rows_align_and_unit_norm(tmp_path, books_path, books_df, encoder):
    s = _settings(tmp_path, books_path)
    run(s, encoder=encoder)
    emb = np.load(s.output_dir / "desc_embeddings.npy")
    rows = pd.read_parquet(s.output_dir / "desc_rows.parquet")
    assert emb.shape == (8, encoder.dim)
    assert rows["work_id"].tolist() == books_df["work_id"].tolist()
    assert rows["row"].tolist() == list(range(8))
    assert np.allclose(np.linalg.norm(emb, axis=1), 1.0, atol=1e-5)


def test_meta_contents(tmp_path, books_path, books_df, encoder):
    s = _settings(tmp_path, books_path)
    meta = run(s, encoder=encoder)
    assert meta["stage"] == "embed"
    assert (meta["embedding_model"], meta["model_revision"], meta["dim"]) == ("test/hash-encoder", "test", 16)
    assert meta["num_books"] == 8
    assert meta["num_fallback_text"] == int((~books_df["has_description"]).sum()) == 2
    assert meta["input_file"] == str(books_path)
    assert meta["input_sha256"] == sha256_file(books_path)
    assert meta["input_data_version"] == "synthetic-test"
    assert meta["code_version"] == "abc123"
    assert meta["created_at"].endswith("Z")
    assert json.loads((s.output_dir / "meta.json").read_text(encoding="utf-8")) == meta


def test_run_log_written(tmp_path, books_path, encoder):
    s = _settings(tmp_path, books_path)
    run(s, encoder=encoder)
    assert "books=8 fallback_text=2" in (s.output_dir / "run.log").read_text(encoding="utf-8")


class NaNEncoder:
    model_name, revision, dim = "nan", "nan", 4

    def encode(self, texts):
        return np.full((len(texts), self.dim), np.nan, dtype=np.float32)


def test_failure_keeps_previous_output(tmp_path, books_path):
    s = _settings(tmp_path, books_path)
    s.output_dir.mkdir()
    (s.output_dir / "marker.txt").write_text("old", encoding="utf-8")
    with pytest.raises(EmbeddingError):
        run(s, encoder=NaNEncoder())
    assert (s.output_dir / "marker.txt").read_text(encoding="utf-8") == "old"
    assert not (tmp_path / "embeddings.tmp").exists()


def test_rerun_replaces_output(tmp_path, books_path, encoder):
    s = _settings(tmp_path, books_path)
    s.output_dir.mkdir()
    (s.output_dir / "marker.txt").write_text("old", encoding="utf-8")
    run(s, encoder=encoder)
    run(s, encoder=encoder)
    assert not (s.output_dir / "marker.txt").exists()
    assert not (tmp_path / "embeddings.old").exists()
    assert not (tmp_path / "embeddings.tmp").exists()


def test_missing_has_description_logs_warning(tmp_path, books_df, encoder, caplog):
    path = tmp_path / "books.parquet"
    books_df.drop(columns=["has_description", "description_issue"]).to_parquet(path, index=False)
    run(_settings(tmp_path, path), encoder=encoder)
    assert "has_description column absent" in caplog.text


def test_main_returns_1_on_bad_input(tmp_path, monkeypatch):
    monkeypatch.setenv("EMBED_INPUT", str(tmp_path / "missing.parquet"))
    monkeypatch.setenv("EMBED_OUTPUT_DIR", str(tmp_path / "out"))
    monkeypatch.setenv("EMBED_CODE_VERSION", "test")
    assert main() == 1
    assert not (tmp_path / "out").exists()
