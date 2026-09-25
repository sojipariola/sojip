"""
Endpoints for the Idea phase.

Transaction pattern: `get_tenant_db` commits on success. Endpoints
only call `flush()` when they need a generated ID before returning.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.repositories.project import ProjectRepository
from app.repositories.validation import PeerValidationRepository
from app.schemas.validation import (
    ValidationCreate,
    ValidationRead,
)

router = APIRouter()

KIND = "lean_canvas"

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




@router.post(
    "/{project_id}/validations",
    response_model=ValidationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_validation(
    project_id: UUID,
    payload: ValidationCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    project = await _load_project_or_404(project_id, ctx, db)

    if project.owner_id == ctx.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot validate your own project",
        )

    repo = PeerValidationRepository(db, ctx)
    if await repo.exists_for_project_and_validator(project_id, ctx.user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already validated this project",
        )

    validation = await repo.create(
        project_id=project_id,
        validator_id=ctx.user_id,
        comment=payload.comment,
        phase="idea",
    )
    await db.flush()
    return validation


@router.get(
    "/{project_id}/validations",
    response_model=list[ValidationRead],
)
async def list_validations(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    repo = PeerValidationRepository(db, ctx)
    return await repo.list_for_project(project_id, phase="idea")


