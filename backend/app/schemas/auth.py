from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="student")
    skill_tier: str = Field(default="beginner")


class LoginRequest(BaseModel):
    tenant_slug: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserRead(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    full_name: str
    role: str
    skill_tier: str

    class Config:
        from_attributes = True
