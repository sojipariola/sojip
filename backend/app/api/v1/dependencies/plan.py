"""
Plan-based feature gating.

Usage in an endpoint:

    @router.post("/projects")
    async def create_project(
        ctx: TenantContext = Depends(get_tenant_context),
        db: AsyncSession = Depends(get_tenant_db),
        _plan: "PlanContext" = Depends(require_plan("projects")),
    ):
        ...

`require_plan(key)` just verifies the key exists and is non-zero/non-null.
`require_plan(key, min_value=5)` also verifies the tenant's limit is >= 5.
`require_plan(key, check_count=lambda db, ctx, limit: ...)` lets you count
current usage (e.g. how many projects already exist) and raise if over.
"""
from dataclasses import dataclass
from typing import Awaitable, Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies.tenant import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.plan import (
    PLAN_FREE,
    Plan,
    STATUS_ACTIVE,
    STATUS_TRIALING,
    Subscription,
)


@dataclass
class PlanContext:
    """Resolved subscription + plan for the current request."""
    subscription: Subscription
    plan: Plan
    limits: dict


async def get_plan_context(
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
) -> PlanContext:
    """
    Load the tenant's active subscription and its plan.

    If no active subscription exists (data integrity bug), fall back to
    the free plan so the tenant is never locked out of the app.
    """
    stmt = (
        select(Subscription, Plan)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(
            Subscription.tenant_id == ctx.tenant_id,
            Subscription.status.in_([STATUS_ACTIVE, STATUS_TRIALING]),
        )
        .limit(1)
    )
    row = (await db.execute(stmt)).first()

    if row is None:
        # Fall back to free plan. This should not happen in normal use —
        # every tenant gets a subscription at signup.
        stmt = select(Plan).where(Plan.slug == PLAN_FREE)
        plan = (await db.execute(stmt)).scalar_one_or_none()
        if plan is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No subscription and no free plan — platform misconfigured",
            )
        fake_sub = Subscription(
            tenant_id=ctx.tenant_id,
            plan_id=plan.id,
            status=STATUS_ACTIVE,
        )
        return PlanContext(subscription=fake_sub, plan=plan, limits=plan.limits or {})

    subscription, plan = row
    return PlanContext(
        subscription=subscription,
        plan=plan,
        limits=plan.limits or {},
    )


# Signature for a custom count callback:
#   async def count(db: AsyncSession, ctx: TenantContext) -> int
UsageCounter = Callable[[AsyncSession, TenantContext], Awaitable[int]]


def require_plan(
    key: str,
    min_value: int = 1,
    check_count: UsageCounter | None = None,
):
    """
    FastAPI dependency factory.

    - If `check_count` is provided, it is awaited to get the current usage.
      The tenant must be under the plan limit to pass.
    - Otherwise, the tenant must have a truthy limit for `key` that is
      at least `min_value`.
    - `None` means unlimited — that always passes.
    """
    async def _dep(
        ctx: TenantContext = Depends(get_tenant_context),
        db: AsyncSession = Depends(get_tenant_db),
        plan_ctx: PlanContext = Depends(get_plan_context),
    ) -> PlanContext:
        limit = plan_ctx.limits.get(key)

        # Unlimited
        if limit is None and key in plan_ctx.limits:
            return plan_ctx

        # Boolean feature (games: true/false)
        if isinstance(limit, bool):
            if not limit:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "feature_not_in_plan",
                        "feature": key,
                        "plan": plan_ctx.plan.slug,
                        "message": (
                            f"The '{key}' feature is not included in the "
                            f"{plan_ctx.plan.name} plan."
                        ),
                    },
                )
            return plan_ctx

        # Numeric limit
        if isinstance(limit, int):
            if limit < min_value:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "plan_limit_too_low",
                        "feature": key,
                        "plan": plan_ctx.plan.slug,
                        "required": min_value,
                        "limit": limit,
                    },
                )

            if check_count is not None:
                current = await check_count(db, ctx)
                if current >= limit:
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail={
                            "error": "plan_limit_reached",
                            "feature": key,
                            "plan": plan_ctx.plan.slug,
                            "limit": limit,
                            "current": current,
                        },
                    )

            return plan_ctx

        # Feature not defined for this plan — treat as unavailable
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "feature_not_in_plan",
                "feature": key,
                "plan": plan_ctx.plan.slug,
            },
        )

    return _dep
