"""Generate toy embeddings and galaxy coordinates for the sample catalogue.

These are NOT model outputs. Each book's embedding is its shelf tags as a
0/1 vector plus a little seeded noise, so books sharing shelves land close
together. The 2-D coordinates are the top two principal components (a
stand-in for the UMAP projection the modeling pipeline will export).

Usage (from src/backend):  uv run python scripts/make_sample_artifacts.py
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "sample_artifacts"
MODEL_VERSION = "sample-shelf-toy-v1"
NOISE_SCALE = 0.05
RANDOM_SEED = 215


def shelf_embeddings(books: list[dict], rng: np.random.Generator) -> np.ndarray:
    vocabulary = sorted({shelf for book in books for shelf in book["shelves"]})
    column = {shelf: i for i, shelf in enumerate(vocabulary)}
    embeddings = np.zeros((len(books), len(vocabulary)), dtype=np.float32)
    for row, book in enumerate(books):
        for shelf in book["shelves"]:
            embeddings[row, column[shelf]] = 1.0
    embeddings += rng.normal(0.0, NOISE_SCALE, embeddings.shape).astype(np.float32)
    return embeddings


def project_2d(embeddings: np.ndarray) -> np.ndarray:
    centred = embeddings - embeddings.mean(axis=0)
    _, _, components = np.linalg.svd(centred, full_matrices=False)
    coords = centred @ components[:2].T
    return (coords / np.abs(coords).max()).astype(np.float32)


def main() -> None:
    books = json.loads((ARTIFACT_DIR / "books.json").read_text(encoding="utf-8"))
    rng = np.random.default_rng(RANDOM_SEED)

    embeddings = shelf_embeddings(books, rng)
    np.save(ARTIFACT_DIR / "item_embeddings.npy", embeddings)
    np.save(ARTIFACT_DIR / "coords_2d.npy", project_2d(embeddings))

    meta = {
        "model_version": MODEL_VERSION,
        "created_at": datetime.now(UTC).date().isoformat(),
        "data_version": "hand-curated-sample-52",
        "note": "Toy shelf-tag embeddings for frontend integration; not a trained model.",
    }
    (ARTIFACT_DIR / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(books)} books, embedding dim {embeddings.shape[1]} to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
