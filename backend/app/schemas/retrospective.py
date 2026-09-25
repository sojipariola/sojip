"""
Retrospective schemas.

A retrospective is a written reflection at the end of a project. It
is the terminal artifact of the SOJIP journey — the piece that turns
experience into wisdom.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Minimum word count for the retrospective to pass the gate
MIN_WORDS = 100


class RetrospectiveContent(BaseModel):
    """
    The three prompts that structure a retrospective.

    The prompts are deliberately narrow: surprise, regret, lesson.
    Together they move the student from "what happened" to "what I'll
    carry forward."
    """
    surprise: str = Field(default="", max_length=5000)
    differently: str = Field(default="", max_length=5000)
    lesson: str = Field(default="", max_length=5000)


class RetrospectiveDocument(BaseModel):
    """The full retrospective artifact. Stored with kind='retrospective'."""
    schema_version: int = 1
    content: RetrospectiveContent = Field(default_factory=RetrospectiveContent)
    submitted_at: datetime | None = None
    ai_critique: str | None = None
    ai_passed: bool | None = None


class RetrospectiveRead(BaseModel):
    """Response shape for GET /maintenance."""
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    phase: str
    kind: str
    data: RetrospectiveDocument
    version: int
    is_current: bool
    locked_at: object | None = None
    locked_by: UUID | None = None


class RetrospectivePatch(BaseModel):
    """Partial update to the retrospective content."""
    surprise: str | None = None
    differently: str | None = None
    lesson: str | None = None


class RetrospectiveWordCount(BaseModel):
    """Helper response for the frontend to show progress."""
    total_words: int
    min_words: int
    passes_gate: bool


class CritiqueResponse(BaseModel):
    """AI critique of the retrospective."""
    passed: bool
    severity: str = "info"
    concern: str | None = None
    reasoning: str
    model: str
