from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LeanCanvas(BaseModel):
    """The four fields of the Lean Canvas for the Idea phase."""
    problem: str | None = None
    solution: str | None = None
    unique_value: str | None = None
    unfair_advantage: str | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    name: str
    slug: str
    description: str | None
    current_phase: str
    owner_id: UUID
    github_repo: str | None = None


class ProjectDetailRead(ProjectRead):
    """
    Detail view of a project.

    Phase-specific content lives in Artifact rows, not on the project.
    The frontend loads the artifact it needs based on the current phase.
    """
    github_repo: str | None = None


class PhaseDataPatch(BaseModel):
    """
    Deprecated. Kept for backward compatibility with the old
    PATCH /projects/{id}/phase-data endpoint.

    New code should use PATCH /projects/{id}/artifacts/{kind}.
    """
    phase_data: dict
