"""
Deployment schemas.

Env vars are stored encrypted in the DB. API responses return masked
values by default (e.g. sk-••••••••1234). A separate `reveal` endpoint
returns the plaintext for a single key on explicit request.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeploymentCreate(BaseModel):
    target: str = Field(default="custom", max_length=40)
    environment: str = Field(default="production", max_length=20)
    url: str | None = Field(None, max_length=500)
    commit_sha: str | None = Field(None, max_length=64)
    version_tag: str | None = Field(None, max_length=50)
    env_vars: dict[str, str] = Field(default_factory=dict)


class DeploymentUpdate(BaseModel):
    url: str | None = Field(None, max_length=500)
    status: str | None = Field(None, max_length=20)
    environment: str | None = Field(None, max_length=20)
    commit_sha: str | None = Field(None, max_length=64)
    version_tag: str | None = Field(None, max_length=50)


class DeploymentRead(BaseModel):
    """
    Public shape of a deployment. Env vars are masked.
    """
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    project_id: UUID
    created_by: UUID | None
    target: str
    environment: str
    url: str | None
    commit_sha: str | None
    version_tag: str | None
    status: str
    health_check_at: datetime | None
    health_check_status: int | None
    health_check_error: str | None
    env_vars_masked: dict[str, str] = Field(default_factory=dict)
    deploy_script: str | None
    rolled_back_from_id: UUID | None
    rolled_back_at: datetime | None
    deployed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class EnvVarsPatch(BaseModel):
    """
    Merge new env vars into a deployment. Set a value to an empty
    string to keep it unchanged (so you can add new keys without
    re-typing existing secrets).
    """
    env_vars: dict[str, str]


class EnvVarReveal(BaseModel):
    key: str
    value: str


class HealthCheckResult(BaseModel):
    status_code: int | None
    is_healthy: bool
    error: str | None = None
    checked_at: datetime


class DeploymentScriptRequest(BaseModel):
    target: str = Field(default="custom", max_length=40)
    include_env: bool = True


class DeploymentScriptResponse(BaseModel):
    target: str
    script: str
    env_example: str
