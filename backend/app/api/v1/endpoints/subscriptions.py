"""
Subscription endpoints.

Admin-only. Manage which plan a tenant is on.

  GET    /subscriptions              — list all subscriptions (platform admin)
  GET    /subscriptions/me           — the current tenant's active subscription
  PATCH  /subscriptions/me           — change the current tenant's plan (admin only)
  GET    /subscriptions/tenant/{id}  — a specific tenant's subscription
"""
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.plan import (
    STATUS_ACTIVE,
    STATUS_CANCELED,
    STATUS_TRIALING,
    Plan,
    Subscription,
)
from app.schemas.billing import (
    PlanRead,
    SubscriptionChange,
    SubscriptionRead,
    SubscriptionWithPlan,
)

router = APIRouter()

ADMIN_ROLES = {"admin"}
ACTIVE_STATUSES = (STATUS_ACTIVE, STATUS_TRIALING)


def _ensure_admin(ctx: TenantContext) -> None:
    if ctx.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )


async def _load_active_subscription(
    tenant_id: UUID, db: AsyncSession
) -> tuple[Subscription, Plan] | None:
    stmt = (
        select(Subscription, Plan)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(
            Subscription.tenant_id == tenant_id,
            Subscription.status.in_(ACTIVE_STATUSES),
        )
        .limit(1)
    )
    return (await db.execute(stmt)).first()


@router.get("/me", response_model=SubscriptionWithPlan)
async def get_my_subscription(
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return the current tenant's active subscription with its plan."""
    row = await _load_active_subscription(ctx.tenant_id, db)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription for this tenant",
        )
    sub, plan = row
    return SubscriptionWithPlan(
        **SubscriptionRead.model_validate(sub).model_dump(),
        plan=PlanRead.model_validate(plan),
    )


@router.patch("/me", response_model=SubscriptionWithPlan)
async def change_my_subscription(
    payload: SubscriptionChange,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Admin-only. Change the current tenant's plan.

    Marks the old subscription as `canceled` and creates a new one on the
    target plan. Keeps history rather than mutating in place.
    """
    _ensure_admin(ctx)

    # Resolve target plan
    stmt = select(Plan).where(Plan.slug == payload.plan_slug)
    target_plan = (await db.execute(stmt)).scalar_one_or_none()
    if target_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan '{payload.plan_slug}' not found",
        )

    now = datetime.now(UTC)

    # Cancel the existing active subscription if present
    existing = await _load_active_subscription(ctx.tenant_id, db)
    if existing is not None:
        old_sub, old_plan = existing
        if old_plan.id == target_plan.id:
            # Same plan — nothing to do
            return SubscriptionWithPlan(
                **SubscriptionRead.model_validate(old_sub).model_dump(),
                plan=PlanRead.model_validate(old_plan),
            )
        old_sub.status = STATUS_CANCELED
        old_sub.canceled_at = now

    new_status = payload.status or STATUS_ACTIVE
    sub = Subscription(
        tenant_id=ctx.tenant_id,
        plan_id=target_plan.id,
        status=new_status,
        note=payload.note,
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)

    return SubscriptionWithPlan(
        **SubscriptionRead.model_validate(sub).model_dump(),
        plan=PlanRead.model_validate(target_plan),
    )


@router.get("/tenant/{tenant_id}", response_model=SubscriptionWithPlan)
async def get_tenant_subscription(
    tenant_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    Admin-only. Read another tenant's subscription.

    Note: this endpoint intentionally crosses tenant boundaries, so it
    must NEVER be used by non-admins. The `_ensure_admin` check is the
    only guard — there is no tenant filter on the query.
    """
    _ensure_admin(ctx)

    row = await _load_active_subscription(tenant_id, db)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription for that tenant",
        )
    sub, plan = row
    return SubscriptionWithPlan(
        **SubscriptionRead.model_validate(sub).model_dump(),
        plan=PlanRead.model_validate(plan),
    )
