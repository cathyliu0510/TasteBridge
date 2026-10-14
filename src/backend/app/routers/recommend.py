from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.artifacts import ModelArtifacts
from app.dependencies import get_artifacts
from app.recommend_service import UnknownBooksError, recommend
from app.schemas import RecommendRequest, RecommendResponse

router = APIRouter(tags=["recommend"])


@router.post("/recommend", response_model=RecommendResponse)
def post_recommend(
    request: RecommendRequest,
    artifacts: Annotated[ModelArtifacts, Depends(get_artifacts)],
) -> RecommendResponse:
    try:
        return recommend(artifacts, request)
    except UnknownBooksError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"message": "Unknown book_id values", "unknown_ids": exc.unknown_ids},
        ) from exc
