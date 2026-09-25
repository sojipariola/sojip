"""
Scaffold phase endpoints — real GitHub integration.

Two routers:
- `router` — job management under /projects/{id}/scaffold/*
- `templates_router` — the template catalog at /scaffold/templates
"""
import re
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, get_tenant_context, get_tenant_db
from app.config import settings
from app.core.database import AsyncSessionLocal
from app.core.github_client import (
    GitHubError,
    create_initial_commit,
    create_repo,
)
from app.core.scaffold_templates import TEMPLATES, get_template
from app.core.scaffold_templates_files import render_template
from app.core.tenant_context import TenantContext
from app.core.token_crypto import TokenCryptoError, decrypt_token
from app.models.scaffold_job import ScaffoldJob
from app.models.user import User
from app.repositories.project import ProjectRepository
from app.schemas.scaffold import ScaffoldJobRead, ScaffoldStartRequest, TemplateInfo

router = APIRouter()
templates_router = APIRouter()

REPO_NAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _append_log(job_id, stage_name: str, progress: int, extra: dict | None = None):
    """Append a log entry and update progress. Uses its own session."""
    async with AsyncSessionLocal() as db:
        stmt = select(ScaffoldJob).where(ScaffoldJob.id == job_id)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if job is None:
            return
        job.current_stage = stage_name
        job.progress = progress
        entry = {
            "at": datetime.now(UTC).isoformat(),
            "stage": stage_name,
            "progress": progress,
        }
        if extra:
            entry.update(extra)
        job.log = list(job.log or []) + [entry]
        await db.commit()


async def _mark_failed(job_id, error_message: str):
    async with AsyncSessionLocal() as db:
        stmt = select(ScaffoldJob).where(ScaffoldJob.id == job_id)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if job is None:
            return
        job.status = "failed"
        job.error_message = error_message
        job.completed_at = datetime.now(UTC)
        await db.commit()


async def _run_real_scaffold(
    job_id: UUID,
    project_id: UUID,
    user_id: UUID,
    template_id: str,
    owner_type: str,
    repo_name: str,
    private: bool,
):
    """
    Background worker that creates a real GitHub repository.
    """
    # ─── 1. Load user + project
    async with AsyncSessionLocal() as db:
        user_stmt = select(User).where(User.id == user_id)
        user = (await db.execute(user_stmt)).scalar_one_or_none()

        if user is None or not user.github_token_encrypted:
            await _mark_failed(job_id, "GitHub account not connected")
            return

        try:
            token = decrypt_token(user.github_token_encrypted)
        except TokenCryptoError as e:
            await _mark_failed(job_id, "Could not decrypt GitHub token: " + str(e))
            return

    async with AsyncSessionLocal() as db:
        from app.models.project import Project
        pstmt = select(Project).where(Project.id == project_id)
        project = (await db.execute(pstmt)).scalar_one_or_none()
        if project is None:
            await _mark_failed(job_id, "Project not found")
            return
        project_name = project.name
        project_slug = project.slug
        project_description = project.description or ""

    # ─── 2. Validate template
    template = get_template(template_id)
    if template is None:
        await _mark_failed(job_id, "Unknown template: " + template_id)
        return

    # ─── 3. Build the files
    await _append_log(job_id, "generating_files", 15)
    files = render_template(
        template_id,
        {
            "project_name": project_name,
            "project_slug": project_slug,
            "description": project_description,
        },
    )
    if not files:
        await _mark_failed(job_id, "Template produced no files")
        return

    # ─── 4. Create the repo
    await _append_log(job_id, "creating_repo", 40)

    org = settings.github_org if owner_type == "org" else None
    try:
        repo_data = await create_repo(
            token,
            repo_name,
            owner_type=owner_type,
            org=org,
            private=private,
            description=project_description or project_name,
        )
    except GitHubError as e:
        await _mark_failed(job_id, "GitHub: " + str(e) + " (" + e.detail + ")")
        return

    repo_full_name = repo_data["full_name"]
    repo_html_url = repo_data["html_url"]

    # Update the job with the repo URL as soon as we have it
    async with AsyncSessionLocal() as db:
        stmt = select(ScaffoldJob).where(ScaffoldJob.id == job_id)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if job:
            job.repo_full_name = repo_full_name
            job.repo_url = repo_html_url
            await db.commit()

    # ─── 5. Push the initial commit
    await _append_log(job_id, "pushing_commit", 70)

    try:
        await create_initial_commit(
            token,
            repo_full_name.split("/")[0],
            repo_name,
            files,
            message="Initial scaffold from SOJIP",
        )
    except GitHubError as e:
        await _mark_failed(job_id, "GitHub commit failed: " + str(e))
        return

    # ─── 6. Finalize
    await _append_log(job_id, "finalizing", 95)

    async with AsyncSessionLocal() as db:
        stmt = select(ScaffoldJob).where(ScaffoldJob.id == job_id)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if job:
            job.status = "completed"
            job.progress = 100
            job.current_stage = "done"
            job.completed_at = datetime.now(UTC)
            await db.commit()

    # Also link the repo to the project
    async with AsyncSessionLocal() as db:
        from app.models.project import Project
        pstmt = select(Project).where(Project.id == project_id)
        project = (await db.execute(pstmt)).scalar_one_or_none()
        if project:
            project.github_repo = repo_html_url
            await db.commit()


# ─── Templates ───────────────────────────────────────────

@templates_router.get("/templates", response_model=list[TemplateInfo])
async def list_templates():
    return TEMPLATES


# ─── Jobs ────────────────────────────────────────────────

@router.get("/{project_id}/scaffold/jobs", response_model=list[ScaffoldJobRead])
async def list_jobs(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    stmt = (
        select(ScaffoldJob)
        .where(
            ScaffoldJob.tenant_id == ctx.tenant_id,
            ScaffoldJob.project_id == project_id,
        )
        .order_by(ScaffoldJob.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{project_id}/scaffold/jobs/{job_id}", response_model=ScaffoldJobRead)
async def get_job(
    project_id: UUID,
    job_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    stmt = select(ScaffoldJob).where(
        ScaffoldJob.id == job_id,
        ScaffoldJob.tenant_id == ctx.tenant_id,
        ScaffoldJob.project_id == project_id,
    )
    job = (await db.execute(stmt)).scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )
    return job


@router.post(
    "/{project_id}/scaffold/start",
    response_model=ScaffoldJobRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_scaffold(
    project_id: UUID,
    payload: ScaffoldStartRequest,
    background_tasks: BackgroundTasks,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
    user: User = Depends(get_current_user),
):
    await _load_project_or_404(project_id, ctx, db)

    template = get_template(payload.template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown template id: " + payload.template_id,
        )

    if not REPO_NAME_RE.match(payload.repo_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid repository name",
        )

    if not user.github_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect your GitHub account before generating a repository.",
        )

    # Cancel any existing queued/running job for this project
    stmt = select(ScaffoldJob).where(
        ScaffoldJob.tenant_id == ctx.tenant_id,
        ScaffoldJob.project_id == project_id,
        ScaffoldJob.status.in_(["queued", "running"]),
    )
    existing = (await db.execute(stmt)).scalars().all()
    for e in existing:
        e.status = "cancelled"

    job = ScaffoldJob(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        created_by=ctx.user_id,
        template_id=payload.template_id,
        status="queued",
        progress=0,
        current_stage="queued",
        log=[],
    )
    db.add(job)
    await db.flush()
    job_id = job.id

    background_tasks.add_task(
        _run_real_scaffold,
        job_id,
        project_id,
        user.id,
        payload.template_id,
        payload.owner_type,
        payload.repo_name,
        payload.private,
    )

    stmt = select(ScaffoldJob).where(ScaffoldJob.id == job_id)
    job = (await db.execute(stmt)).scalar_one()
    return job
