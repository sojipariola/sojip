from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    phase: str
    kind: str
    data: dict
    version: int
    is_current: bool
    locked_at: datetime | None
    locked_by: UUID | None


class ArtifactUpdate(BaseModel):
    """Full replacement of an artifact's data."""
    data: dict


class ArtifactPatch(BaseModel):
    """Merge new fields into the artifact's data."""
    data: dict


class LockRequest(BaseModel):
    """Empty body — the endpoint locks the current artifact."""
    pass
