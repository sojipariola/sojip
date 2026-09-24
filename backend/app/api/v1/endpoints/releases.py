"""
Release endpoints.

Every release is a shipped iteration — a version tag, a severity, and
the student's own changelog entry.
"""
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.release import SEVERITIES, Release
from app.repositories.project import ProjectRepository
from app.schemas.release import (
    ReleaseCreate,
    ReleaseRead,
    VersionSuggestion,
)

router = APIRouter()


VERSION_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?$")


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def _parse_version(tag: str) -> tuple[int, int, int] | None:
    """Parse v1.2.3 or 1.2.3 into (1, 2, 3). Returns None on failure."""
    m = VERSION_RE.match(tag.strip())
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def _bump(version: tuple[int, int, int], severity: str) -> str:
    major, minor, patch = version
    if severity == "major":
        return f"v{major + 1}.0.0"
    if severity == "minor":
        return f"v{major}.{minor + 1}.0"
    return f"v{major}.{minor}.{patch + 1}"


@router.get(
    "/{project_id}/releases",
    response_model=list[ReleaseRead],
)
async def list_releases(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    stmt = (
        select(Release)
        .where(
            Release.tenant_id == ctx.tenant_id,
            Release.project_id == project_id,
        )
        .order_by(Release.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{project_id}/releases/suggest-version",
    response_model=VersionSuggestion,
)
async def suggest_version(
    project_id: UUID,
    severity: str = "minor",
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Suggest the next version tag based on the latest release.
    """
    await _load_project_or_404(project_id, ctx, db)

    if severity not in SEVERITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="severity must be one of: " + ", ".join(SEVERITIES),
        )

    stmt = (
        select(Release)
        .where(
            Release.tenant_id == ctx.tenant_id,
            Release.project_id == project_id,
        )
        .order_by(Release.created_at.desc())
        .limit(1)
    )
    latest = (await db.execute(stmt)).scalar_one_or_none()

    if latest is None:
        # No releases yet — start at v0.1.0
        return VersionSuggestion(
            suggested="v0.1.0",
            reason="First release. Starting at v0.1.0.",
        )

    parsed = _parse_version(latest.version_tag)
    if parsed is None:
        return VersionSuggestion(
            suggested="v0.1.0",
            reason="Previous tag could not be parsed. Defaulting to v0.1.0.",
        )

    next_tag = _bump(parsed, severity)
    return VersionSuggestion(
        suggested=next_tag,
        reason=f"Bumped {severity} from {latest.version_tag}.",
    )


@router.post(
    "/{project_id}/releases",
    response_model=ReleaseRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_release(
    project_id: UUID,
    payload: ReleaseCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)

    if payload.severity not in SEVERITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="severity must be one of: " + ", ".join(SEVERITIES),
        )

    if _parse_version(payload.version_tag) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="version_tag must look like v1.2.3 or 1.2.3",
        )

    # Ensure this version tag isn't already used for this project
    stmt = select(Release).where(
        Release.tenant_id == ctx.tenant_id,
        Release.project_id == project_id,
        Release.version_tag == payload.version_tag,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Version " + payload.version_tag + " already exists",
        )

    release = Release(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        created_by=ctx.user_id,
        version_tag=payload.version_tag,
        severity=payload.severity,
        changelog=payload.changelog,
        commit_sha=payload.commit_sha,
        deployed_at=datetime.now(timezone.utc),
    )
    db.add(release)
    await db.flush()
    await db.refresh(release)
    return release


@router.delete(
    "/{project_id}/releases/{release_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_release(
    project_id: UUID,
    release_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    stmt = select(Release).where(
        Release.id == release_id,
        Release.tenant_id == ctx.tenant_id,
        Release.project_id == project_id,
    )
    release = (await db.execute(stmt)).scalar_one_or_none()
    if release is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Release not found",
        )
    await db.delete(release)
