from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CommitReviewRequest(BaseModel):
    sha: str = Field(..., min_length=4, max_length=64)


class CommitReview(BaseModel):
    id: UUID
    commit_sha: str
    commit_short_sha: str
    passed: bool
    severity: str
    concern: str | None
    reasoning: str
    model: str
    created_at: datetime


class CommitReviewList(BaseModel):
    reviews: list[CommitReview]
