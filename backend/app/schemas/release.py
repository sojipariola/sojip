from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReleaseCreate(BaseModel):
    version_tag: str = Field(..., min_length=1, max_length=50)
    severity: str = Field(default="minor", pattern="^(patch|minor|major)$")
    changelog: str = Field(..., min_length=20, max_length=5000)
    commit_sha: str | None = Field(None, max_length=64)


class ReleaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    created_by: UUID | None
    version_tag: str
    severity: str
    changelog: str
    commit_sha: str | None
    deployed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class VersionSuggestion(BaseModel):
    """Suggested next version tag based on the current state."""
    suggested: str
    reason: str
