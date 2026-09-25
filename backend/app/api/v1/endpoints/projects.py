"""
Project CRUD endpoints.

Transaction pattern: `get_tenant_db` commits on success. Endpoints
only call `flush()` when they need a generated ID before returning.
"""
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.api.v1.dependencies.plan import PlanContext, require_plan
from app.core.tenant_context import TenantContext
from app.models.artifact import Artifact
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectDetailRead, ProjectRead

router = APIRouter()


async def _count_projects(db, ctx):
    """Count the tenant's existing projects for the plan gate."""
    from sqlalchemy import func, select

    from app.models.project import Project
    stmt = (
        select(func.count())
        .select_from(Project)
        .where(Project.tenant_id == ctx.tenant_id)
    )
    return int((await db.execute(stmt)).scalar_one())


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = Field(None, max_length=2000)


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:150]


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    repo = ProjectRepository(db, ctx)
    return await repo.list_all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
    _plan: PlanContext = Depends(
        require_plan("projects", check_count=_count_projects)
    ),
):
    repo = ProjectRepository(db, ctx)
    slug = _slugify(payload.name)
    if await repo.slug_exists(slug):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A project with slug '{slug}' already exists in this tenant",
        )
    project = await repo.create(
        owner_id=ctx.user_id,
        name=payload.name,
        slug=slug,
        description=payload.description,
        current_phase="idea",
    )
    await db.flush()

    # Seed an empty Lean Canvas so the Idea page always has something
    # to load. Without this, GET /projects/{id}/artifacts/lean_canvas
    # returns 404 on a fresh project.
    db.add(Artifact(
        tenant_id=ctx.tenant_id,
        project_id=project.id,
        phase="idea",
        kind="lean_canvas",
        data={
            "problem": "",
            "solution": "",
            "unique_value": "",
            "unfair_advantage": "",
        },
        version=1,
        is_current=True,
    ))
    await db.flush()

    return project


@router.get("/{project_id}", response_model=ProjectDetailRead)
async def get_project(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


# ─────────────────────────────────────────────────────────
# Project deletion — high-caution endpoint.
#
# This endpoint has THREE independent guards:
#   1. Only the project owner or an admin can call it.
#   2. The request body must contain `confirm_slug` matching the
#      project's actual slug. A client can't delete by accident.
#   3. If the project has any current artifact with non-empty data,
#      the caller must ALSO pass `force=true`. This protects live work.
# ─────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel  # noqa: E402


class DeleteProjectRequest(_BaseModel):
    confirm_slug: str
    force: bool = False


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    payload: DeleteProjectRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Delete a project and everything attached to it.

    The request body must contain `confirm_slug` equal to the project's
    slug. This is the guard against accidental deletion — a client can
    never fire this from a stray click.

    If the project has non-empty work in progress, the caller must also
    pass `force=true`.
    """
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Guard 1: permission
    is_owner = project.owner_id == ctx.user_id
    is_admin = ctx.role == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner or an admin can delete this project",
        )

    # Guard 2: confirmation phrase
    if payload.confirm_slug.strip() != project.slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Confirmation slug does not match. "
                f"Expected '{project.slug}'."
            ),
        )

    # Guard 3: work-in-progress check
    has_content = False
    if not payload.force:
        from sqlalchemy import select as _select

        from app.models.artifact import Artifact

        stmt = (
            _select(Artifact)
            .where(
                Artifact.tenant_id == ctx.tenant_id,
                Artifact.project_id == project_id,
                Artifact.is_current.is_(True),
            )
        )
        artifacts = list((await db.execute(stmt)).scalars().all())

        for a in artifacts:
            data = a.data or {}
            if a.kind == "lean_canvas":
                # Any non-empty field counts as content
                for v in data.values():
                    if isinstance(v, str) and v.strip():
                        has_content = True
                        break
            elif a.kind == "task_graph":
                if data.get("tasks"):
                    has_content = True
            elif a.kind == "system_diagram":
                if data.get("nodes") or data.get("edges"):
                    has_content = True
            if has_content:
                break

    if has_content and not payload.force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "project_has_content",
                "message": (
                    "This project has work in progress. Pass force=true "
                    "to confirm deletion of all its artifacts."
                ),
            },
        )

    # Everything checks out — delete. Cascade rules on the FKs remove
    # artifacts, remarks, peer validations, scaffold jobs, releases,
    # and deployments in one shot.
    await db.delete(project)
    await db.flush()
    return None
