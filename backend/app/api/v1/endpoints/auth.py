from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies.auth import get_current_user
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.user import ROLES, SKILL_TIERS, User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user under an existing tenant.

    The caller must supply the tenant_slug. This keeps tenant
    registration separate from user registration — an admin creates
    the Tenant, then users self-register into it.
    """
    if payload.role not in ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(ROLES)}",
        )
    if payload.skill_tier not in SKILL_TIERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid skill_tier. Must be one of: {', '.join(SKILL_TIERS)}",
        )

    # Find the tenant
    tenant_stmt = select(Tenant).where(
        Tenant.slug == payload.tenant_slug,
        Tenant.is_active.is_(True),
    )
    tenant = (await db.execute(tenant_stmt)).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{payload.tenant_slug}' not found",
        )

    # Check email uniqueness within the tenant
    existing_stmt = select(User).where(
        User.tenant_id == tenant.id,
        User.email == payload.email,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered in this tenant",
        )

    user = User(
        tenant_id=tenant.id,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        skill_tier=payload.skill_tier,
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Login and receive a JWT.

    The token carries `sub` (user_id) and `tid` (tenant_id). Every
    authenticated request uses these claims — never the request body —
    to establish tenant context.
    """
    tenant_stmt = select(Tenant).where(
        Tenant.slug == payload.tenant_slug,
        Tenant.is_active.is_(True),
    )
    tenant = (await db.execute(tenant_stmt)).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user_stmt = select(User).where(
        User.tenant_id == tenant.id,
        User.email == payload.email,
        User.is_active.is_(True),
    )
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token, expires_in = create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
        skill_tier=user.skill_tier,
    )
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user. Requires Bearer token."""
    return user
