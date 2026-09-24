"""
Plan endpoints.

Public:
  GET /plans               — list active plans (for the pricing page)

Admin-only:
  GET    /plans/all        — list all plans, including inactive
  PATCH  /plans/{slug}     — update a plan's copy, price, or limits
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.database import get_db
from app.core.tenant_context import TenantContext
from app.models.plan import Plan
from app.schemas.billing import PlanRead, PlanUpdate

router = APIRouter()

ADMIN_ROLES = {"admin"}


def _ensure_admin(ctx: TenantContext) -> None:
    if ctx.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )


@router.get("", response_model=list[PlanRead])
async def list_public_plans(
    db: AsyncSession = Depends(get_db),
):
    """List active plans. Public — no authentication required."""
    stmt = (
        select(Plan)
        .where(Plan.is_active.is_(True))
        .order_by(Plan.sort_order.asc(), Plan.price_cents.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/all", response_model=list[PlanRead])
async def list_all_plans(
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Admin-only. Includes inactive plans so they can be reactivated."""
    _ensure_admin(ctx)
    stmt = select(Plan).order_by(Plan.sort_order.asc(), Plan.price_cents.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.patch("/{slug}", response_model=PlanRead)
async def update_plan(
    slug: str,
    payload: PlanUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    _ensure_admin(ctx)

    stmt = select(Plan).where(Plan.slug == slug)
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan '{slug}' not found",
        )

    if payload.name is not None:
        plan.name = payload.name
    if payload.description is not None:
        plan.description = payload.description
    if payload.price_cents is not None:
        plan.price_cents = payload.price_cents
    if payload.limits is not None:
        plan.limits = payload.limits
    if payload.is_active is not None:
        plan.is_active = payload.is_active
    if payload.sort_order is not None:
        plan.sort_order = payload.sort_order

    await db.flush()
    await db.refresh(plan)
    return plan
