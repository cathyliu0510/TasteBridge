"""Tests for quality.py. All data here is invented, never real Goodreads data."""

import json

import numpy as np
import pandas as pd
import pytest

from quality import (
    MIN_DESCRIPTION_CHARS,
    SHELF_BLOCKLIST,
    check_description,
    clean_description,
    clean_shelves,
    is_generic_shelf,
    normalize_shelf,
)


# ---------------------------------------------------------------- descriptions


@pytest.mark.parametrize(
    "raw", [None, float("nan"), pd.NA, np.nan, "", "   ", "<br><br>", "<p> </p>"]
)
def test_clean_description_missing(raw):
    assert clean_description(raw) is None


def test_clean_description_strips_tags_then_unescapes():
    raw = "<b>Locke Lamora</b> is a thief.<br>A very good one, in a city of canals."
    assert clean_description(raw) == (
        "Locke Lamora is a thief. A very good one, in a city of canals."
    )


def test_clean_description_keeps_escaped_angle_brackets():
    assert clean_description("Book 2 of &lt;Gentleman Bastard&gt;") == (
        "Book 2 of <Gentleman Bastard>"
    )


def test_clean_description_decodes_entities_and_collapses_whitespace():
    assert clean_description("Cats &amp; dogs\n\n\tforever") == "Cats & dogs forever"


def test_check_description_missing():
    assert check_description(None) == (None, "missing")
    assert check_description("<br>") == (None, "missing")


def test_check_description_too_short_keeps_text():
    assert check_description("A novel.") == ("A novel.", "too_short")


def test_check_description_boundary_is_inclusive():
    exactly = "x" * MIN_DESCRIPTION_CHARS
    assert check_description(exactly) == (exactly, None)
    assert check_description(exactly[:-1]) == (exactly[:-1], "too_short")


def test_check_description_custom_threshold():
    assert check_description("A novel.", min_chars=5) == ("A novel.", None)


# --------------------------------------------------------------------- shelves


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Found Family", "found-family"),
        ("sci_fi", "science-fiction"),
        ("Sci-Fi", "science-fiction"),
        ("scifi", "science-fiction"),
        ("YA", "young-adult"),
        ("  to--read ", "to-read"),
        ("Favourites", "favorites"),
        ("-heist-", "heist"),
    ],
)
def test_normalize_shelf(raw, expected):
    assert normalize_shelf(raw) == expected


@pytest.mark.parametrize("name", sorted(SHELF_BLOCKLIST))
def test_blocklist_entries_are_generic(name):
    assert is_generic_shelf(name)


@pytest.mark.parametrize(
    "name",
    [
        "2015", "read-in-2016", "2017-reads", "2017-read", "read-2018",
        "5-stars", "4stars", "1-star", "3.stars",
        "to-read-fantasy", "owned-hardcover", "kindle-unlimited", "tbr-2019",
        "To-Read", "Currently Reading",
    ],
)
def test_pattern_and_case_variants_are_generic(name):
    assert is_generic_shelf(name)


@pytest.mark.parametrize(
    "name",
    [
        "heist", "fantasy", "mystery", "1920s", "historical-fiction",
        "wish-fulfillment", "found-family", "science-fiction", "young-adult",
        "magic-school",
    ],
)
def test_content_shelves_are_kept(name):
    assert not is_generic_shelf(name)


def test_clean_shelves_spec_example():
    raw = [
        {"name": "to-read", "count": "5120"},
        {"name": "fantasy", "count": "2100"},
        {"name": "currently-reading", "count": "900"},
        {"name": "favorites", "count": "450"},
        {"name": "heist", "count": "310"},
        {"name": "kindle", "count": "120"},
        {"name": "Found Family", "count": "95"},
        {"name": "2017-reads", "count": "40"},
    ]
    assert clean_shelves(raw) == ["fantasy", "heist", "found-family"]


def test_clean_shelves_merges_after_normalization():
    raw = [
        {"name": "sci-fi", "count": "2"},
        {"name": "heist", "count": "3"},
        {"name": "Science Fiction", "count": "2"},
    ]
    assert clean_shelves(raw) == ["science-fiction", "heist"]


def test_clean_shelves_min_count_and_top_n():
    raw = [{"name": f"tag-{i}", "count": str(100 - i)} for i in range(30)]
    raw.append({"name": "rare", "count": "2"})
    assert clean_shelves(raw, min_count=3, top_n=20) == [f"tag-{i}" for i in range(20)]
    assert "rare" not in clean_shelves(raw, min_count=3, top_n=50)


def test_clean_shelves_ties_keep_first_seen_order():
    raw = [
        {"name": "beta", "count": "5"},
        {"name": "alpha", "count": "5"},
        {"name": "gamma", "count": "9"},
    ]
    assert clean_shelves(raw) == ["gamma", "beta", "alpha"]


def test_clean_shelves_plain_strings_count_as_infinite():
    assert clean_shelves(["heist", "to-read", "Found Family"]) == ["heist", "found-family"]


def test_clean_shelves_count_with_thousands_separator():
    raw = [{"name": "heist", "count": "1,234"}, {"name": "caper", "count": "2,000"}]
    assert clean_shelves(raw) == ["caper", "heist"]


@pytest.mark.parametrize("raw", [None, float("nan"), pd.NA, [], np.array([], dtype=object)])
def test_clean_shelves_empty_inputs(raw):
    assert clean_shelves(raw) == []


def test_clean_shelves_accepts_numpy_array_from_parquet():
    raw = np.array(
        [{"name": "heist", "count": "10"}, {"name": "to-read", "count": "99"}], dtype=object
    )
    assert clean_shelves(raw) == ["heist"]


def test_clean_shelves_skips_unknown_shapes():
    raw = [
        {"name": "heist", "count": "10"},
        {"count": "5"},
        {"name": None, "count": "5"},
        42,
        None,
        {"name": "caper", "count": "lots"},
    ]
    assert clean_shelves(raw) == ["heist"]
