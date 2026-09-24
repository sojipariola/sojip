"""
Tenant-scoped endpoints.

Currently exposes the user list for the current tenant, used by
task ownership pickers and reviewer dropdowns.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_tenant_context, get_tenant_db
from app.core.tenant_context import TenantContext
from app.models.user import User
from app.schemas.tenant import TenantUserRead

router = APIRouter()


@router.get("/me", response_model=dict)
async def get_my_tenant(
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Return the current tenant's basic info."""
    return {
        "tenant_id": str(ctx.tenant_id),
        "role": ctx.role,
        "skill_tier": ctx.skill_tier,
    }


@router.get("/me/users", response_model=list[TenantUserRead])
async def list_tenant_users(
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_tenant_db),
):
    """
    List all active users in the current tenant.

    Used by the task ownership picker. Ordered by role priority
    (teachers/admins first, then students/innovators), then by name.
    """
    stmt = select(User).where(
        User.tenant_id == ctx.tenant_id,
        User.is_active.is_(True),
    )
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    role_order = {"admin": 0, "teacher": 1, "innovator": 2, "student": 3}
    users.sort(key=lambda u: (role_order.get(u.role, 99), u.full_name))

    return users
