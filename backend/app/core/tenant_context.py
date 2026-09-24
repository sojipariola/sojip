from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class TenantContext:
    """
    Immutable tenant context bound to a single request.

    `tenant_id` comes from the JWT claim `tid` — never from request
    bodies, query parameters, or headers, which are user-controllable
    and would allow tenant spoofing.
    """
    tenant_id: UUID
    user_id: UUID
    role: str
    skill_tier: str
