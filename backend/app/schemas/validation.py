from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ValidationCreate(BaseModel):
    comment: str | None = Field(None, max_length=500)


class ValidationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    validator_id: UUID
    comment: str | None
    phase: str


class GateCheckResult(BaseModel):
    """Result of a phase gate validation."""
    gate: str
    passed: bool
    reason: str
    missing: list[str] = Field(default_factory=list)
    ai_feedback: str | None = None
