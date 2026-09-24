"""
Billing schemas.

Plan + Subscription shapes. Separate from app/schemas/plan.py, which
holds the Plan-phase task graph schemas.
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    slug: str
    name: str
    description: str | None
    price_cents: int
    currency: str
    billing_interval: str
    limits: dict[str, Any]
    is_active: bool
    sort_order: int


class PlanUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)
    price_cents: int | None = Field(None, ge=0)
    limits: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    tenant_id: UUID
    plan_id: UUID
    status: str
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at_period_end: bool
    canceled_at: datetime | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class SubscriptionWithPlan(SubscriptionRead):
    plan: PlanRead


class SubscriptionChange(BaseModel):
    plan_slug: str = Field(..., min_length=1, max_length=50)
    status: str | None = Field(None, pattern="^(active|trialing|past_due|canceled)$")
    note: str | None = Field(None, max_length=2000)
