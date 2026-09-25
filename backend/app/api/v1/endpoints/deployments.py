"""
Deployment endpoints.

Manages deployment attempts: creation, status, health checks, env
vars (encrypted), and rollback history.
"""
from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.deploy_scripts import generate_deploy_script, generate_env_example
from app.core.tenant_context import TenantContext
from app.core.token_crypto import TokenCryptoError, decrypt_token, encrypt_token
from app.models.deployment import ENVIRONMENTS, STATUSES, TARGETS, Deployment
from app.repositories.project import ProjectRepository
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentRead,
    DeploymentScriptRequest,
    DeploymentScriptResponse,
    DeploymentUpdate,
    EnvVarReveal,
    EnvVarsPatch,
    HealthCheckResult,
)

router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────

async def _load_project_or_404(project_id, ctx, db):
    repo = ProjectRepository(db, ctx)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _load_deployment_or_404(deployment_id, project_id, ctx, db):
    stmt = select(Deployment).where(
        Deployment.id == deployment_id,
        Deployment.tenant_id == ctx.tenant_id,
        Deployment.project_id == project_id,
    )
    d = (await db.execute(stmt)).scalar_one_or_none()
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    return d


def _mask_value(value: str) -> str:
    """Show first 4 and last 4 chars, mask the middle."""
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return value[:4] + ("•" * max(len(value) - 8, 4)) + value[-4:]


def _to_read(deployment: Deployment) -> DeploymentRead:
    masked: dict[str, str] = {}
    for k in (deployment.env_vars_encrypted or {}).keys():
        masked[k] = "••••••••"
    return DeploymentRead(
        id=deployment.id,
        project_id=deployment.project_id,
        created_by=deployment.created_by,
        target=deployment.target,
        environment=deployment.environment,
        url=deployment.url,
        commit_sha=deployment.commit_sha,
        version_tag=deployment.version_tag,
        status=deployment.status,
        health_check_at=deployment.health_check_at,
        health_check_status=deployment.health_check_status,
        health_check_error=deployment.health_check_error,
        env_vars_masked=masked,
        deploy_script=deployment.deploy_script,
        rolled_back_from_id=deployment.rolled_back_from_id,
        rolled_back_at=deployment.rolled_back_at,
        deployed_at=deployment.deployed_at,
        created_at=deployment.created_at,
        updated_at=deployment.updated_at,
    )


async def _run_health_check(deployment: Deployment, db: AsyncSession) -> HealthCheckResult:
    """Ping the deployment URL and record the result."""
    now = datetime.now(UTC)
    deployment.health_check_at = now

    if not deployment.url:
        deployment.status = "unreachable"
        deployment.health_check_status = None
        deployment.health_check_error = "No URL configured"
        await db.flush()
        return HealthCheckResult(
            status_code=None,
            is_healthy=False,
            error="No URL configured",
            checked_at=now,
        )

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(deployment.url)

        deployment.health_check_status = r.status_code
        if 200 <= r.status_code < 400:
            deployment.status = "healthy"
            deployment.health_check_error = None
            if deployment.deployed_at is None:
                deployment.deployed_at = now
            await db.flush()
            return HealthCheckResult(
                status_code=r.status_code,
                is_healthy=True,
                error=None,
                checked_at=now,
            )
        else:
            deployment.status = "unhealthy"
            deployment.health_check_error = (
                "HTTP " + str(r.status_code) + " from " + deployment.url
            )
            await db.flush()
            return HealthCheckResult(
                status_code=r.status_code,
                is_healthy=False,
                error=deployment.health_check_error,
                checked_at=now,
            )
    except httpx.TimeoutException:
        deployment.status = "unreachable"
        deployment.health_check_status = None
        deployment.health_check_error = "Request timed out after 10s"
        await db.flush()
        return HealthCheckResult(
            status_code=None,
            is_healthy=False,
            error="Timeout",
            checked_at=now,
        )
    except httpx.HTTPError as e:
        deployment.status = "unreachable"
        deployment.health_check_status = None
        deployment.health_check_error = "Network error: " + str(e)
        await db.flush()
        return HealthCheckResult(
            status_code=None,
            is_healthy=False,
            error=str(e),
            checked_at=now,
        )




@router.get(
    "/{project_id}/deployments/{deployment_id}/env-example",
)
async def get_env_example(
    project_id: UUID,
    deployment_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Return the current env keys as a .env.example file (values blank).
    Students can commit this to their repo as documentation.
    """
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)

    keys = list((d.env_vars_encrypted or {}).keys())
    content = generate_env_example(keys)
    return {"filename": ".env.example", "content": content, "keys": keys}


@router.post(
    "/{project_id}/deployments/generate-script",
    response_model=DeploymentScriptResponse,
)
async def generate_script(
    project_id: UUID,
    payload: DeploymentScriptRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Generate a shell script to deploy the project to the chosen target.

    Uses the most recent deployment's env keys (if one exists) to
    build the .env section of the script.
    """
    project = await _load_project_or_404(project_id, ctx, db)

    # Find the most recent deployment to grab env keys from
    stmt = (
        select(Deployment)
        .where(
            Deployment.tenant_id == ctx.tenant_id,
            Deployment.project_id == project_id,
        )
        .order_by(Deployment.created_at.desc())
        .limit(1)
    )
    latest = (await db.execute(stmt)).scalar_one_or_none()

    env_keys: list[str] = []
    if latest is not None:
        env_keys = list((latest.env_vars_encrypted or {}).keys())

    script = generate_deploy_script(
        target=payload.target,
        project_name=project.name,
        project_slug=project.slug,
        env_keys=env_keys if payload.include_env else [],
    )
    env_example = generate_env_example(env_keys)

    return DeploymentScriptResponse(
        target=payload.target,
        script=script,
        env_example=env_example,
    )

# ─── Endpoints ───────────────────────────────────────────

@router.get(
    "/{project_id}/deployments",
    response_model=list[DeploymentRead],
)
async def list_deployments(
    project_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    stmt = (
        select(Deployment)
        .where(
            Deployment.tenant_id == ctx.tenant_id,
            Deployment.project_id == project_id,
        )
        .order_by(Deployment.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_to_read(d) for d in result.scalars().all()]


@router.post(
    "/{project_id}/deployments",
    response_model=DeploymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_deployment(
    project_id: UUID,
    payload: DeploymentCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)

    if payload.target not in TARGETS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target must be one of: " + ", ".join(TARGETS),
        )
    if payload.environment not in ENVIRONMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="environment must be one of: " + ", ".join(ENVIRONMENTS),
        )

    # Encrypt env vars
    encrypted: dict[str, str] = {}
    for k, v in (payload.env_vars or {}).items():
        if v:
            encrypted[k] = encrypt_token(v)

    now = datetime.now(UTC)
    deployment = Deployment(
        tenant_id=ctx.tenant_id,
        project_id=project_id,
        created_by=ctx.user_id,
        target=payload.target,
        environment=payload.environment,
        url=payload.url,
        commit_sha=payload.commit_sha,
        version_tag=payload.version_tag,
        status="pending",
        env_vars_encrypted=encrypted,
        created_at=now,
        updated_at=now,
    )
    db.add(deployment)
    await db.flush()

    # If a URL was provided, run a health check immediately
    if deployment.url:
        await _run_health_check(deployment, db)

    # Reload attributes that were expired by the flush/refresh cycle in
    # _run_health_check. Safe because the transaction is still open.
    await db.refresh(deployment)

    return _to_read(deployment)


@router.patch(
    "/{project_id}/deployments/{deployment_id}",
    response_model=DeploymentRead,
)
async def update_deployment(
    project_id: UUID,
    deployment_id: UUID,
    payload: DeploymentUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)

    if payload.url is not None:
        d.url = payload.url
    if payload.environment is not None:
        if payload.environment not in ENVIRONMENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="invalid environment",
            )
        d.environment = payload.environment
    if payload.commit_sha is not None:
        d.commit_sha = payload.commit_sha
    if payload.version_tag is not None:
        d.version_tag = payload.version_tag
    if payload.status is not None:
        if payload.status not in STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="invalid status",
            )
        d.status = payload.status

    await db.flush()
    await db.refresh(d)
    return _to_read(d)


@router.delete(
    "/{project_id}/deployments/{deployment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_deployment(
    project_id: UUID,
    deployment_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)
    await db.delete(d)


@router.post(
    "/{project_id}/deployments/{deployment_id}/health-check",
    response_model=HealthCheckResult,
)
async def check_health(
    project_id: UUID,
    deployment_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)
    result = await _run_health_check(d, db)
    return result


@router.patch(
    "/{project_id}/deployments/{deployment_id}/env",
    response_model=DeploymentRead,
)
async def patch_env_vars(
    project_id: UUID,
    deployment_id: UUID,
    payload: EnvVarsPatch,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Merge env vars. Empty strings keep the existing value (so a client
    can send a masked form back without losing secrets).
    """
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)

    current = dict(d.env_vars_encrypted or {})
    for k, v in (payload.env_vars or {}).items():
        if v == "":
            # Keep existing
            continue
        current[k] = encrypt_token(v)
    d.env_vars_encrypted = current

    await db.flush()
    await db.refresh(d)
    return _to_read(d)


@router.get(
    "/{project_id}/deployments/{deployment_id}/env/{key}/reveal",
    response_model=EnvVarReveal,
)
async def reveal_env_var(
    project_id: UUID,
    deployment_id: UUID,
    key: str,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Reveal a single env var value. Used by the "copy" action in the UI.

    Note: this endpoint is audited at the application layer (we log
    the request) but we don't yet have an audit table. Adding that is
    a future task.
    """
    await _load_project_or_404(project_id, ctx, db)
    d = await _load_deployment_or_404(deployment_id, project_id, ctx, db)

    encrypted = (d.env_vars_encrypted or {}).get(key)
    if encrypted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Env var not found",
        )

    try:
        value = decrypt_token(encrypted)
    except TokenCryptoError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt value",
        )

    return EnvVarReveal(key=key, value=value)
