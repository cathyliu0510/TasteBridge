"""Catalogue search for the 'Pick your five' screen (SPEC.md 4.2)."""

from collections.abc import Sequence

from app.schemas import Book


def search_books(books: Sequence[Book], query: str, limit: int) -> list[Book]:
    """Case-insensitive title/author match; titles starting with the query come first."""
    needle = query.strip().casefold()
    if not needle:
        return []

    title_prefix: list[Book] = []
    other_matches: list[Book] = []
    for book in books:
        title = book.title.casefold()
        if title.startswith(needle):
            title_prefix.append(book)
        elif needle in title or needle in book.author.casefold():
            other_matches.append(book)
        if len(title_prefix) >= limit:
            break
    return (title_prefix + other_matches)[:limit]
