"""
UI Workspace endpoints.

Manages a workspace artifact (kind="ui_workspace") for each project.
Cross-cutting — not owned by any phase.

Endpoints:
  GET    /projects/{id}/workspace                    load
  PATCH  /projects/{id}/workspace                    partial update (mode, meta)
  PUT    /projects/{id}/workspace                    full replace
  POST   /projects/{id}/workspace/components         add component
  PATCH  /projects/{id}/workspace/components/{cid}   update component
  DELETE /projects/{id}/workspace/components/{cid}   delete component
  POST   /projects/{id}/workspace/reorder            reorder (stacked mode)
"""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.schemas.workspace import (
    ComponentCreate,
    ComponentReorder,
    ComponentUpdate,
    WorkspaceComponent,
    WorkspaceDocument,
    WorkspacePatch,
    WorkspaceRead,
)

router = APIRouter()

KIND = "ui_workspace"


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _load_or_create(project_id: UUID, ctx: TenantContext, db: AsyncSession) -> Artifact:
    repo = ArtifactRepository(db, ctx)
    artifact = await repo.get_current(project_id, KIND)
    if artifact is not None:
        return artifact

    artifact = Artifact(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        phase="workspace",
        kind=KIND,
        data=WorkspaceDocument().model_dump(mode="json"),
        version=1,
        is_current=True,
    )
    db.add(artifact)
    await db.flush()
    return artifact


def _parse(artifact: Artifact) -> WorkspaceDocument:
    try:
        return WorkspaceDocument.model_validate(artifact.data or {})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Malformed workspace: " + str(e),
        )


def _ensure_unlocked(artifact: Artifact) -> None:
    if artifact.locked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Workspace is locked. Unlock to continue editing.",
        )


# ─── Load / Save ─────────────────────────────────────────

@router.get("/{project_id}/workspace", response_model=WorkspaceRead)
async def get_workspace(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    return artifact


@router.patch("/{project_id}/workspace", response_model=WorkspaceRead)
async def patch_workspace(
    project_id: UUID,
    payload: WorkspacePatch,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    doc = _parse(artifact)
    if payload.mode is not None:
        doc.mode = payload.mode
    if payload.components is not None:
        doc.components = payload.components
    if payload.meta is not None:
        merged = dict(doc.meta or {})
        merged.update(payload.meta)
        doc.meta = merged

    artifact.data = doc.model_dump(mode="json")
    await db.flush()
    await db.refresh(artifact)
    return artifact


@router.put("/{project_id}/workspace", response_model=WorkspaceRead)
async def replace_workspace(
    project_id: UUID,
    payload: WorkspaceDocument,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    artifact.data = payload.model_dump(mode="json")
    await db.flush()
    await db.refresh(artifact)
    return artifact


# ─── Components ──────────────────────────────────────────

@router.post(
    "/{project_id}/workspace/components",
    response_model=WorkspaceComponent,
    status_code=status.HTTP_201_CREATED,
)
async def add_component(
    project_id: UUID,
    payload: ComponentCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    doc = _parse(artifact)
    new_id = "c-" + uuid4().hex[:12]

    # Build the layout. If the caller didn't provide one, create a fresh
    # ComponentLayout and assign the next order index for stacked mode.
    from app.schemas.workspace import ComponentLayout
    if payload.layout is not None:
        layout = payload.layout
    else:
        layout = ComponentLayout()

    if layout.order is None and doc.mode == "stacked":
        layout.order = len(doc.components)

    component = WorkspaceComponent(
        id=new_id,
        type=payload.type,
        props=payload.props or {},
        layout=layout,
    )
    doc.components.append(component)
    artifact.data = doc.model_dump(mode="json")
    await db.flush()
    return component


@router.patch(
    "/{project_id}/workspace/components/{component_id}",
    response_model=WorkspaceComponent,
)
async def update_component(
    project_id: UUID,
    component_id: str,
    payload: ComponentUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    doc = _parse(artifact)
    for i, c in enumerate(doc.components):
        if c.id == component_id:
            if payload.props is not None:
                merged = dict(c.props)
                merged.update(payload.props)
                c.props = merged
            if payload.layout is not None:
                c.layout = payload.layout
            doc.components[i] = c
            artifact.data = doc.model_dump(mode="json")
            await db.flush()
            return c

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Component not found",
    )


@router.delete(
    "/{project_id}/workspace/components/{component_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_component(
    project_id: UUID,
    component_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    doc = _parse(artifact)
    original = len(doc.components)
    doc.components = [c for c in doc.components if c.id != component_id]
    if len(doc.components) == original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Component not found",
        )
    # Re-order the remaining components in stacked mode
    if doc.mode == "stacked":
        for i, c in enumerate(doc.components):
            c.layout.order = i
    artifact.data = doc.model_dump(mode="json")
    await db.flush()


@router.post("/{project_id}/workspace/reorder", response_model=WorkspaceRead)
async def reorder_components(
    project_id: UUID,
    payload: ComponentReorder,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_or_create(project_id, ctx, db)
    _ensure_unlocked(artifact)

    doc = _parse(artifact)
    current_ids = {c.id for c in doc.components}
    if set(payload.ordered_ids) != current_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_ids must match current component IDs exactly",
        )

    by_id = {c.id: c for c in doc.components}
    doc.components = [by_id[cid] for cid in payload.ordered_ids]
    for i, c in enumerate(doc.components):
        c.layout.order = i
    artifact.data = doc.model_dump(mode="json")
    await db.flush()
    await db.refresh(artifact)
    return artifact
