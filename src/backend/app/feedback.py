"""Anonymous feedback votes, appended to a JSON-lines file (SPEC.md 4.5).

Privacy rule from the proposal: store only book_id, vote, model_version and a
timestamp. No names, IP addresses, reading lists or session IDs.
"""

import json
import threading
from datetime import UTC, datetime
from pathlib import Path


class FeedbackStoreError(RuntimeError):
    """A vote could not be written to storage."""


class FeedbackStore:
    """Holds the log path and a lock so concurrent requests don't interleave lines."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()

    def record(self, book_id: str, vote: str, model_version: str) -> None:
        line = json.dumps(
            {
                "book_id": book_id,
                "vote": vote,
                "model_version": model_version,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
        try:
            with self._lock:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                with self._path.open("a", encoding="utf-8") as log:
                    log.write(line + "\n")
        except OSError as exc:
            raise FeedbackStoreError(f"Could not write feedback to {self._path}") from exc
