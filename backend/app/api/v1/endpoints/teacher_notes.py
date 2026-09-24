"""
Teacher notes endpoints.

Read access: any authenticated user in the tenant.
Write access: teacher or admin role only.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.phases import PHASE_ORDER
from app.core.tenant_context import TenantContext
from app.models.teacher_note import TeacherNote
from app.repositories.teacher_note import TeacherNoteRepository
from app.schemas.teacher_note import (
    TeacherNoteCreate,
    TeacherNoteRead,
    TeacherNoteUpdate,
)

router = APIRouter()

WRITE_ROLES = {"teacher", "admin"}


def _ensure_can_write(ctx: TenantContext) -> None:
    if ctx.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can write notes",
        )


@router.get("", response_model=list[TeacherNoteRead])
async def list_notes(
    include_drafts: bool = False,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List notes visible to the caller. Drafts are teacher-only."""
    repo = TeacherNoteRepository(db, ctx)
    if include_drafts and ctx.role not in WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can view drafts",
        )
    return await repo.list_for_tenant(include_drafts=include_drafts)


@router.get("/phase/{phase}", response_model=TeacherNoteRead | None)
async def get_note_for_phase(
    phase: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the published note for a phase, or 404 if none exists."""
    if phase not in PHASE_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown phase '{phase}'",
        )
    repo = TeacherNoteRepository(db, ctx)
    note = await repo.get_published_for_phase(phase)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No published note for phase '{phase}'",
        )
    return note


@router.post("", response_model=TeacherNoteRead,
             status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: TeacherNoteCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    _ensure_can_write(ctx)

    if payload.phase not in PHASE_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"phase must be one of: {', '.join(PHASE_ORDER)}",
        )

    repo = TeacherNoteRepository(db, ctx)

    # If publishing and one already exists, reject with a clear message.
    if payload.is_published:
        existing = await repo.get_published_for_phase(payload.phase)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"A published note already exists for '{payload.phase}'. "
                    "Unpublish it or update it instead."
                ),
            )

    note = TeacherNote(
        tenant_id=ctx.tenant_id,
        phase=payload.phase,
        author_id=ctx.user_id,
        title=payload.title,
        body=payload.body,
        links=[link.model_dump() for link in payload.links],
        is_published=payload.is_published,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=TeacherNoteRead)
async def update_note(
    note_id: UUID,
    payload: TeacherNoteUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    _ensure_can_write(ctx)

    repo = TeacherNoteRepository(db, ctx)
    note = await repo.get_by_id(note_id)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    if payload.title is not None:
        note.title = payload.title
    if payload.body is not None:
        note.body = payload.body
    if payload.links is not None:
        note.links = [link.model_dump() for link in payload.links]
    if payload.is_published is not None:
        # Check for a collision when publishing
        if payload.is_published and not note.is_published:
            existing = await repo.get_published_for_phase(note.phase)
            if existing is not None and existing.id != note.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Another published note already exists for "
                        f"'{note.phase}'."
                    ),
                )
        note.is_published = payload.is_published

    await db.flush()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    _ensure_can_write(ctx)
    repo = TeacherNoteRepository(db, ctx)
    note = await repo.get_by_id(note_id)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    await db.delete(note)
