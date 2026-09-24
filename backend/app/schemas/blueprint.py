"""
Blueprint schemas — the system diagram artifact.
"""
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Diagram content ─────────────────────────────────────

class DiagramNode(BaseModel):
    """
    A single box on the system diagram.

    `kind` categorizes the node — one of: frontend, backend, database,
    queue, cache, auth, external, other.
    """
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1, max_length=120)
    kind: str = Field(default="backend")
    description: str | None = None
    tech_stack: list[str] = Field(default_factory=list)
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})


class DiagramEdge(BaseModel):
    """
    A connection between two nodes.

    `kind` categorizes the edge — api_call, data_flow, event, dependency.

    `authenticated` and `rate_limited` only apply to api_call edges that
    mutate state. The security linter uses them.
    """
    id: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    label: str | None = None
    kind: str = Field(default="data_flow")
    method: str | None = None
    path: str | None = None
    authenticated: bool = True
    rate_limited: bool = False


class SystemDiagram(BaseModel):
    """The full Blueprint artifact. Stored with kind='system_diagram'."""
    nodes: list[DiagramNode] = Field(default_factory=list)
    edges: list[DiagramEdge] = Field(default_factory=list)


# ─── Response shapes ─────────────────────────────────────

class SystemDiagramRead(BaseModel):
    """
    Response shape for GET /projects/{id}/blueprint.

    `data` is the diagram itself. The other fields come from the
    Artifact row (version, lock state).
    """
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    phase: str
    kind: str
    data: SystemDiagram
    version: int
    is_current: bool
    locked_at: object | None = None
    locked_by: UUID | None = None


# ─── Security report ─────────────────────────────────────

class SecurityIssue(BaseModel):
    severity: str = Field(..., description="info | warning | error")
    node_id: str | None = None
    edge_id: str | None = None
    message: str
    suggestion: str | None = None


class SecurityReport(BaseModel):
    issues: list[SecurityIssue]
    passed: bool
    summary: str
