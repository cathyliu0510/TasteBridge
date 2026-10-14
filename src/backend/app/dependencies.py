"""Shared objects created at startup, handed to routes via Depends()."""

from fastapi import Request

from app.artifacts import ModelArtifacts
from app.feedback import FeedbackStore


def get_artifacts(request: Request) -> ModelArtifacts:
    return request.app.state.artifacts


def get_feedback_store(request: Request) -> FeedbackStore:
    return request.app.state.feedback_store
