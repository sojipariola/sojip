"""
Phase workspace endpoints.

These endpoints serve any phase — the artifact `kind` determines
which phase's tools apply. For the Idea phase, kind = "lean_canvas".

Endpoints:

  GET    /projects/{id}/artifacts/{kind}
  PATCH  /projects/{id}/artifacts/{kind}                merge fields
  POST   /projects/{id}/artifacts/{kind}/lock           lock for review
  POST   /projects/{id}/artifacts/{kind}/unlock         unlock

  GET    /projects/{id}/remarks                         list all remarks
  POST   /projects/{id}/remarks                         add remark
  DELETE /projects/{id}/remarks/{remark_id}             delete remark

  POST   /projects/{id}/artifacts/{kind}/critique       per-field AI critique
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.models.remark import (
    KIND_COMMENT,
    KIND_CRITIQUE,
    ROLE_AI,
    ROLE_TEACHER,
    Remark,
)
from app.repositories.artifact import ArtifactRepository
from app.repositories.project import ProjectRepository
from app.repositories.remark import RemarkRepository
from app.schemas.artifact import ArtifactPatch, ArtifactRead
from app.schemas.remark import (
    FieldCritiqueRequest,
    RemarkCreate,
    RemarkRead,
)
from app.services.ai_service import get_ai_service

router = APIRouter()

# Field prompts — keep in sync with frontend labels
FIELD_PROMPTS = {
    "problem": "Who specifically has this problem?",
    "solution": "What does it do?",
    "unique_value": "Why this, and not the obvious alternative?",
    "unfair_advantage": "What can't be easily copied?",
}

# Fields teachers are allowed to comment on. Students can comment on all.
TEACHER_COMMENTABLE_ROLES = {"teacher", "admin"}


async def _load_project_or_404(
    project_id: UUID, ctx: TenantContext, db: AsyncSession
):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


# Default empty payloads for known artifact kinds. When a project
# doesn't yet have one of these, GET auto-creates it so the phase page
# always loads.
_EMPTY_ARTIFACTS: dict[str, dict] = {
    "lean_canvas": {
        "problem": "",
        "solution": "",
        "unique_value": "",
        "unfair_advantage": "",
    },
    "task_graph": {"tasks": [], "deadline": None, "budget_days": None},
    "system_diagram": {"nodes": [], "edges": []},
}


async def _load_artifact_or_404(
    project_id: UUID,
    kind: str,
    ctx: TenantContext,
    db: AsyncSession,
    *,
    must_be_current: bool = True,
) -> Artifact:
    repo = ArtifactRepository(db, ctx)
    artifact = await repo.get_current(project_id, kind)

    if artifact is None:
        # Auto-create empty artifacts for known phase kinds. This keeps
        # old projects loadable even if they were created before the
        # artifact was seeded.
        if kind in _EMPTY_ARTIFACTS:
            phase_map = {
                "lean_canvas": "idea",
                "task_graph": "plan",
                "system_diagram": "blueprint",
            }
            artifact = Artifact(
                tenant_id=ctx.tenant_id,
                project_id=project_id,
                phase=phase_map.get(kind, "idea"),
                kind=kind,
                data=dict(_EMPTY_ARTIFACTS[kind]),
                version=1,
                is_current=True,
            )
            db.add(artifact)
            await db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No {kind} artifact found for this project",
            )

    if must_be_current and not artifact.is_current:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This artifact is not the current version",
        )
    return artifact


@router.get(
    "/{project_id}/artifacts/{kind}",
    response_model=ArtifactRead,
)
async def get_artifact(
    project_id: UUID,
    kind: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)
    return artifact


@router.patch(
    "/{project_id}/artifacts/{kind}",
    response_model=ArtifactRead,
)
async def patch_artifact(
    project_id: UUID,
    kind: str,
    payload: ArtifactPatch,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Merge new keys into the artifact's `data`.

    If the artifact is locked, rejects the write with 423 Locked.
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)

    if artifact.is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Artifact is locked for review. Unlock to continue editing.",
        )

    merged = dict(artifact.data or {})
    merged.update(payload.data)
    artifact.data = merged

    await db.flush()
    return artifact


@router.post(
    "/{project_id}/artifacts/{kind}/lock",
    response_model=ArtifactRead,
)
async def lock_artifact(
    project_id: UUID,
    kind: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)

    if artifact.is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Artifact is already locked",
        )

    from datetime import datetime, timezone

    artifact.locked_at = datetime.now(timezone.utc)
    artifact.locked_by = ctx.user_id
    await db.flush()
    return artifact


@router.post(
    "/{project_id}/artifacts/{kind}/unlock",
    response_model=ArtifactRead,
)
async def unlock_artifact(
    project_id: UUID,
    kind: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Unlock an artifact.

    Only the project owner or a teacher/admin can unlock.
    """
    project = await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)

    is_owner = project.owner_id == ctx.user_id
    is_teacher = ctx.role in TEACHER_COMMENTABLE_ROLES
    if not (is_owner or is_teacher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner or a teacher can unlock",
        )

    artifact.locked_at = None
    artifact.locked_by = None
    await db.flush()
    return artifact


@router.get(
    "/{project_id}/remarks",
    response_model=list[RemarkRead],
)
async def list_remarks(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    repo = RemarkRepository(db, ctx)
    return await repo.list_for_project(project_id)


@router.post(
    "/{project_id}/remarks",
    response_model=RemarkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_remark(
    project_id: UUID,
    payload: RemarkCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    project = await _load_project_or_404(project_id, ctx, db)

    # Find the current artifact for the project. For now we look up by
    # the phase the project is in — Idea phase → lean_canvas.
    kind_map = {
        "idea": "lean_canvas",
        "plan": "task_graph",
        "blueprint": "system_diagram",
        "maintenance": "retrospective",
    }
    kind = kind_map.get(project.current_phase)
    if kind is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No remarkable artifact for phase '{project.current_phase}'",
        )

    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)

    # Determine author role string
    author_role = ctx.role  # "student" | "teacher" | "innovator" | "admin"

    remark = Remark(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        artifact_id=artifact.id,
        author_id=ctx.user_id,
        field_path=payload.field_path,
        body=payload.body,
        author_role=author_role,
        kind=KIND_COMMENT,
    )
    db.add(remark)
    await db.flush()
    return remark


@router.delete(
    "/{project_id}/remarks/{remark_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_remark(
    project_id: UUID,
    remark_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    repo = RemarkRepository(db, ctx)
    remark = await repo.get_by_id(remark_id)
    if remark is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remark not found",
        )
    is_author = remark.author_id == ctx.user_id
    is_teacher = ctx.role in TEACHER_COMMENTABLE_ROLES
    if not (is_author or is_teacher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or a teacher can delete a remark",
        )
    await db.delete(remark)


@router.post(
    "/{project_id}/artifacts/{kind}/critique",
    response_model=RemarkRead,
    status_code=status.HTTP_201_CREATED,
)
async def critique_field(
    project_id: UUID,
    kind: str,
    payload: FieldCritiqueRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Ask the AI Mentor to critique a single field.

    The critique is stored as a Remark with author_role="ai".
    """
    await _load_project_or_404(project_id, ctx, db)
    artifact = await _load_artifact_or_404(project_id, kind, ctx, db)

    field_path = payload.field_path
    field_value = artifact.data.get(field_path, "")
    field_prompt = FIELD_PROMPTS.get(field_path, "")

    if not field_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown field '{field_path}' for {kind}",
        )

    ai = get_ai_service()
    critique = await ai.critique_field(
        field_name=field_path,
        field_prompt=field_prompt,
        field_value=field_value,
    )

    body = critique.get("body") or "No critique returned."
    severity = critique.get("severity", "info")

    remark = Remark(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        artifact_id=artifact.id,
        author_id=None,
        field_path=field_path,
        body=body,
        author_role=ROLE_AI,
        kind=KIND_CRITIQUE,
    )
    # Store severity inside the body prefix for now (no separate column).
    # If this becomes load-bearing, add a `metadata` JSONB column later.
    if severity != "info":
        remark.body = f"[{severity}] {body}"

    db.add(remark)
    await db.flush()
    return remark

@router.get(
    "/{project_id}/artifacts/{kind}/versions",
    response_model=list[ArtifactRead],
)
async def list_artifact_versions(
    project_id: UUID,
    kind: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return all versions of an artifact, newest first."""
    await _load_project_or_404(project_id, ctx, db)
    repo = ArtifactRepository(db, ctx)
    return await repo.list_versions(project_id, kind)
