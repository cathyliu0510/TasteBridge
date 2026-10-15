"""Synthetic Goodreads-shaped data for tests and the no-download demo run.

Readers have a few favourite genres and sub-genres ("clusters"); works
have a skewed popularity. That gives item-kNN real co-like structure to
find, so a correct harness should rank it above popularity. Nothing here
comes from the Goodreads dataset, so it is safe to commit.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

GENRES = ("fantasy", "mystery", "romance", "science-fiction", "horror", "historical")
CLUSTERS_PER_GENRE = 5


def generate(
    n_users: int = 1000, n_works: int = 600, mean_shelved: int = 45, seed: int = 0
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    n_genres = len(GENRES)

    primary = rng.integers(0, n_genres, size=n_works)
    cluster = primary * CLUSTERS_PER_GENRE + rng.integers(0, CLUSTERS_PER_GENRE, size=n_works)
    secondary = np.where(rng.random(n_works) < 0.35, rng.integers(0, n_genres, size=n_works), -1)
    popularity = 1 / np.arange(1, n_works + 1) ** 0.8
    popularity = popularity[rng.permutation(n_works)]

    genre_member = np.zeros((n_works, n_genres))
    genre_member[np.arange(n_works), primary] = 1.0
    has_second = secondary >= 0
    genre_member[np.flatnonzero(has_second), secondary[has_second]] = 0.5

    books = pd.DataFrame(
        {
            "work_id": [f"w{i:04d}" for i in range(n_works)],
            "title": [f"Synthetic Work {i}" for i in range(n_works)],
            "author": [f"Author {c:02d}-{i % 3}" for i, c in enumerate(cluster)],
            "genres": [
                "|".join(dict.fromkeys([GENRES[p]] + ([GENRES[s]] if s >= 0 else [])))
                for p, s in zip(primary, secondary)
            ],
        }
    )

    rows = []
    n_clusters = n_genres * CLUSTERS_PER_GENRE
    for u in range(n_users):
        taste = rng.dirichlet(np.full(n_genres, 0.3))
        cluster_pref = np.zeros(n_clusters)
        cluster_pref[rng.choice(n_clusters, size=3, replace=False, p=np.repeat(taste, CLUSTERS_PER_GENRE) / CLUSTERS_PER_GENRE)] = 1.0
        affinity = genre_member @ taste + 1.5 * cluster_pref[cluster]
        weight = popularity**0.6 * (0.02 + affinity)
        n_shelved = min(n_works, max(10, rng.poisson(mean_shelved)))
        works = rng.choice(n_works, size=n_shelved, replace=False, p=weight / weight.sum())
        p_like = 1 / (1 + np.exp(-(3 * affinity[works] - 1.2)))
        liked = rng.random(len(works)) < p_like
        ratings = np.where(liked, rng.choice([4, 5], size=len(works)), rng.choice([0, 1, 2, 3], size=len(works)))
        rows.extend((f"u{u:05d}", f"w{w:04d}", int(r)) for w, r in zip(works, ratings))

    interactions = pd.DataFrame(rows, columns=["user_id", "work_id", "rating"])
    return interactions, books


def write(out_dir: str | Path, **kwargs) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    interactions, books = generate(**kwargs)
    interactions_path, books_path = out_dir / "interactions.csv", out_dir / "books.csv"
    interactions.to_csv(interactions_path, index=False)
    books.to_csv(books_path, index=False)
    return interactions_path, books_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Write synthetic interactions.csv and books.csv")
    parser.add_argument("--out", default="sample_data")
    parser.add_argument("--users", type=int, default=1000)
    parser.add_argument("--works", type=int, default=600)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    paths = write(args.out, n_users=args.users, n_works=args.works, seed=args.seed)
    print(*paths, sep="\n")


if __name__ == "__main__":
    main()
