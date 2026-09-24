from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RemarkCreate(BaseModel):
    field_path: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1, max_length=2000)


class RemarkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    artifact_id: UUID
    author_id: UUID | None
    field_path: str
    body: str
    author_role: str
    kind: str
    created_at: datetime


class FieldCritiqueRequest(BaseModel):
    """Ask the AI Mentor for a per-field critique."""
    field_path: str = Field(..., min_length=1, max_length=255)
