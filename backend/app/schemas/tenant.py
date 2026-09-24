from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TenantUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    email: str
    full_name: str
    role: str
    skill_tier: str
