"""Runtime settings, read once from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACT_DIR = BACKEND_ROOT / "sample_artifacts"
DEFAULT_FEEDBACK_PATH = BACKEND_ROOT / "feedback" / "feedback.jsonl"


@dataclass(frozen=True)
class Settings:
    artifact_dir: str
    feedback_path: Path
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        raw_origins = os.getenv("CORS_ORIGINS", "*")
        origins = tuple(o.strip() for o in raw_origins.split(",") if o.strip())
        if not origins:
            raise ValueError(
                "CORS_ORIGINS is set but empty; use '*' or a comma-separated list of origins"
            )
        return cls(
            artifact_dir=os.getenv("ARTIFACT_DIR", str(DEFAULT_ARTIFACT_DIR)),
            feedback_path=Path(os.getenv("FEEDBACK_PATH", str(DEFAULT_FEEDBACK_PATH))),
            cors_origins=origins,
        )
