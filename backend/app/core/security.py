from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    user_id: UUID,
    tenant_id: UUID,
    role: str,
    skill_tier: str,
) -> tuple[str, int]:
    """
    Returns (token, expires_in_seconds).

    The `tid` claim is the tenant_id. It is used by get_current_user
    to load the User in a tenant-scoped way.
    """
    expires_delta = timedelta(hours=settings.jwt_expiry_hours)
    expire = datetime.now(timezone.utc) + expires_delta

    payload = {
        "sub": str(user_id),
        "tid": str(tenant_id),
        "role": role,
        "skill_tier": skill_tier,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    token = jwt.encode(
        payload, settings.secret_key, algorithm=settings.jwt_algorithm
    )
    return token, int(expires_delta.total_seconds())
