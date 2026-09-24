from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScaffoldJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    template_id: str
    status: str
    progress: int
    current_stage: str | None
    repo_url: str | None
    repo_full_name: str | None
    preview_url: str | None
    error_message: str | None
    log: list
    completed_at: datetime | None
    created_at: datetime


class ScaffoldStartRequest(BaseModel):
    template_id: str = Field(..., min_length=1, max_length=50)
    owner_type: Literal["personal", "org"] = "personal"
    repo_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z0-9._-]+$",
        description="Repository name. Alphanumerics, dot, underscore, hyphen only.",
    )
    private: bool = True


class TemplateInfo(BaseModel):
    id: str
    name: str
    description: str
    tech_stack: list[str]
    node_kinds: list[str]
    icon: str
    # "fullstack" | "standalone"
    category: str = "fullstack"
    # Suggested default deploy target for this template
    default_deploy_target: str | None = None
    # How this app type gets verified live ("http" | "registry" | "manual")
    verification_kind: str = "http"
    # "fullstack" | "standalone"
    category: str = "fullstack"
    # Suggested default deploy target for this template
    default_deploy_target: str | None = None
    # How this app type gets verified live ("http" | "registry" | "manual")
    verification_kind: str = "http"


class RepoExistsCheck(BaseModel):
    """Response from the check-repo-name endpoint."""
    available: bool
    suggestion: str | None = None
    reason: str | None = None
