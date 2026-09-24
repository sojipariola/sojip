"""
UI Workspace schemas.

A workspace is a visual composition of Shadcn components. Students
drag components onto a canvas, configure their props, and export
JSX. The workspace JSON is a portable format — any tool that
speaks this schema can render or edit it.

Schema version is explicit so we can evolve without breaking.
"""
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


LayoutMode = Literal["free", "stacked", "grid"]


class ComponentLayout(BaseModel):
    """
    Position/size metadata. Interpretation depends on layout mode.

    - stacked: `order` (int) — position in the vertical flow
    - free:    `x`, `y`, `w`, `h` — absolute coordinates in pixels
    - grid:    `col`, `row`, `col_span`, `row_span` — 12-column grid
    """
    order: int | None = None
    x: float | None = None
    y: float | None = None
    w: float | None = None
    h: float | None = None
    col: int | None = None
    row: int | None = None
    col_span: int | None = None
    row_span: int | None = None


class WorkspaceComponent(BaseModel):
    """
    A single component instance on the canvas.

    `type` is a Shadcn component name: button, card, badge, input,
    textarea, label, heading, text, separator, tabs, progress,
    skeleton, dialog, dropdown-menu, tooltip.

    `props` is free-form — the schema for each type is enforced on
    the frontend inspector, not here. This keeps the backend
    agnostic to component changes.
    """
    id: str = Field(..., min_length=1, max_length=64)
    type: str = Field(..., min_length=1, max_length=64)
    props: dict[str, Any] = Field(default_factory=dict)
    layout: ComponentLayout = Field(default_factory=ComponentLayout)


class WorkspaceDocument(BaseModel):
    """
    The full workspace document. Stored in artifacts.data with
    kind="ui_workspace".
    """
    schema_version: int = 1
    mode: LayoutMode = "stacked"
    components: list[WorkspaceComponent] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class WorkspaceRead(BaseModel):
    """Response shape for GET /workspace."""
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    phase: str
    kind: str
    data: WorkspaceDocument
    version: int
    is_current: bool
    locked_at: object | None = None
    locked_by: UUID | None = None


class WorkspacePatch(BaseModel):
    """Partial update to the workspace document."""
    mode: LayoutMode | None = None
    components: list[WorkspaceComponent] | None = None
    meta: dict[str, Any] | None = None


class ComponentCreate(BaseModel):
    """Add a single component to the workspace."""
    type: str = Field(..., min_length=1, max_length=64)
    props: dict[str, Any] = Field(default_factory=dict)
    layout: ComponentLayout | None = None


class ComponentUpdate(BaseModel):
    """Update props or layout for a single component."""
    props: dict[str, Any] | None = None
    layout: ComponentLayout | None = None


class ComponentReorder(BaseModel):
    """Reorder components in stacked mode."""
    ordered_ids: list[str]
