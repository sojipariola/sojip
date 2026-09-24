from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import AsyncSessionLocal
from app.core.tenant_context import TenantContext
from app.models.user import User


async def get_tenant_context(
    user: User = Depends(get_current_user),
) -> TenantContext:
    """
    Builds a TenantContext from the authenticated user.

    tenant_id comes from `user.tenant_id`, which was loaded from the
    database using the JWT's `tid` claim. This guarantees the tenant_id
    is server-verified, not client-supplied.

    Fails closed: if the user has no tenant_id (data integrity bug),
    we raise rather than proceed without isolation.
    """
    if user.tenant_id is None:
        raise RuntimeError(
            "User has no tenant_id — data integrity violation."
        )
    return TenantContext(
        tenant_id=user.tenant_id,
        user_id=user.id,
        role=user.role,
        skill_tier=user.skill_tier,
    )


async def get_tenant_db(
    ctx: TenantContext = Depends(get_tenant_context),
) -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a DB session with tenant context set via SET LOCAL.

    CRITICAL: PostgreSQL does NOT allow bind parameters in SET
    statements. We must interpolate the tenant_id as a literal.
    This is safe because:
      1. tenant_id comes from a JWT claim, not user input
      2. we validate it's a UUID before interpolation
      3. UUID format contains only hex digits and hyphens

    SET LOCAL must execute inside an explicit transaction. Outside
    a transaction, SET LOCAL is a no-op (or worse, leaks to the
    next request that reuses this pooled connection).
    """
    # Validate the tenant_id is actually a UUID before interpolating.
    # This is our injection guard — even though the value comes from
    # the JWT, we verify the type before building the SQL string.
    try:
        tenant_uuid = UUID(str(ctx.tenant_id))
    except (ValueError, TypeError) as e:
        raise RuntimeError(f"Invalid tenant_id: {e}") from e

    # Safe to interpolate: tenant_uuid is now guaranteed to be a
    # canonical UUID string (hex digits + hyphens only).
    set_tenant_sql = f"SET LOCAL app.current_tenant = '{tenant_uuid}'"

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text(set_tenant_sql))
            yield session