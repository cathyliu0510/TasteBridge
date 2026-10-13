"""Tests for quality.py. All data here is invented, never real Goodreads data."""

import json

import numpy as np
import pandas as pd
import pytest

from quality import MIN_DESCRIPTION_CHARS, check_description, clean_description


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
