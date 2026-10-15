"""Input contract between preprocessing and evaluation.

Preprocessing hands evaluation two tables (CSV, Parquet or JSON Lines):

interactions: one row per (user, work)
    user_id  str   Goodreads user ID
    work_id  str   work ID (editions already merged)
    rating   int   0-5; 0 means shelved but not rated

books: one row per work
    work_id  str
    genres   list[str] or a "|"-separated string; used only to build
             similar- and different-taste pairs, never by the models
    title, author (optional) carried through for readable output

A "like" is rating >= LIKE_THRESHOLD, as in the proposal.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

LIKE_THRESHOLD = 4
INTERACTION_COLUMNS = ("user_id", "work_id", "rating")
BOOK_COLUMNS = ("work_id", "genres")


class DataContractError(ValueError):
    """An input table does not match the contract above."""


def read_table(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if not path.is_file():
        raise DataContractError(f"Input file not found: {path}")
    name = path.name.lower()
    if name.endswith(".parquet"):
        return pd.read_parquet(path)
    if name.endswith((".csv", ".csv.gz")):
        return pd.read_csv(path, dtype={"user_id": str, "work_id": str})
    if name.endswith((".jsonl", ".jsonl.gz", ".json", ".json.gz")):
        return pd.read_json(path, lines=True, dtype={"user_id": str, "work_id": str})
    raise DataContractError(f"Unsupported file type (use .csv, .parquet or .jsonl): {path}")


def _require(frame: pd.DataFrame, columns: tuple[str, ...], label: str) -> None:
    missing = [c for c in columns if c not in frame.columns]
    if missing:
        raise DataContractError(f"{label} is missing columns: {missing}")


def clean_interactions(frame: pd.DataFrame) -> pd.DataFrame:
    _require(frame, INTERACTION_COLUMNS, "interactions")
    out = frame[list(INTERACTION_COLUMNS)].copy()
    if out[["user_id", "work_id", "rating"]].isna().any().any():
        raise DataContractError("interactions contain missing user_id, work_id or rating values")
    out["user_id"] = out["user_id"].astype(str)
    out["work_id"] = out["work_id"].astype(str)
    out["rating"] = pd.to_numeric(out["rating"], errors="raise").astype(int)
    if not out["rating"].between(0, 5).all():
        raise DataContractError("ratings must be between 0 and 5")
    # Several editions of one work can leave duplicate (user, work) rows; keep the best rating.
    out = out.sort_values("rating", ascending=False, kind="stable")
    out = out.drop_duplicates(["user_id", "work_id"], keep="first")
    return out.sort_values(["user_id", "work_id"], kind="stable").reset_index(drop=True)


def _parse_genres(value: object) -> tuple[str, ...]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ()
    if isinstance(value, str):
        parts = value.split("|")
    else:
        parts = list(value)  # list, tuple or numpy array from Parquet
    return tuple(dict.fromkeys(str(p).strip() for p in parts if str(p).strip()))


def clean_books(frame: pd.DataFrame) -> pd.DataFrame:
    _require(frame, BOOK_COLUMNS, "books")
    out = frame.copy()
    out["work_id"] = out["work_id"].astype(str)
    if out["work_id"].duplicated().any():
        raise DataContractError("books contain duplicate work_id values")
    out["genres"] = out["genres"].map(_parse_genres)
    return out.reset_index(drop=True)


def load_interactions(path: str | Path) -> pd.DataFrame:
    return clean_interactions(read_table(path))


def load_books(path: str | Path) -> pd.DataFrame:
    return clean_books(read_table(path))


def likes(interactions: pd.DataFrame) -> pd.DataFrame:
    return interactions[interactions["rating"] >= LIKE_THRESHOLD]


def data_version(path: str | Path) -> dict[str, str]:
    """sha256 of an input file, plus its DVC md5 when a sibling .dvc file exists."""
    path = Path(path)
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    version = {"path": str(path), "sha256": digest.hexdigest()}
    dvc_file = path.with_name(path.name + ".dvc")
    if dvc_file.is_file():
        for line in dvc_file.read_text().splitlines():
            stripped = line.strip().lstrip("- ")
            if stripped.startswith("md5:"):
                version["dvc_md5"] = stripped.split(":", 1)[1].strip()
                break
    return version
