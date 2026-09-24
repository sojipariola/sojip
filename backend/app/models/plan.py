"""
Plan and Subscription models.

A Plan is a template: Free, Pro, Institution. It defines price,
billing interval, and a JSON `limits` dict that gates features.

A Subscription links a Tenant to a Plan with a status and period.
Every tenant has exactly one *active* subscription at a time — the
free plan counts as a subscription.

Feature gating is data-driven: adding a new limit is a JSON change,
not a migration.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.tenant import Tenant


# Well-known plan slugs. Used by the seed script and by feature gates.
PLAN_FREE = "free"
PLAN_PRO = "pro"
PLAN_INSTITUTION = "institution"

# Subscription lifecycle.
STATUS_ACTIVE = "active"
STATUS_TRIALING = "trialing"
STATUS_PAST_DUE = "past_due"
STATUS_CANCELED = "canceled"


class Plan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "plans"

    slug: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Price in the smallest currency unit (cents). 0 for free.
    price_cents: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="usd", server_default="usd"
    )
    # "month" | "year"
    billing_interval: Mapped[str] = mapped_column(
        String(20), nullable=False, default="month", server_default="month"
    )

    # Feature limits. Example:
    #   {"projects": 3, "ai_calls_per_day": 50, "games": true,
    #    "teacher_notes": false, "deployments": 1}
    # A value of `null` or a missing key means "unlimited".
    limits: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    # Whether this plan can be chosen for new subscriptions.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Free plans sort first; paid plans by price.
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="plan"
    )

    def __repr__(self) -> str:
        return f"<Plan {self.slug}>"

    @property
    def is_free(self) -> bool:
        return self.price_cents == 0


class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_ACTIVE, server_default="active"
    )

    # Billing period — nullable for free plans.
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Set when a cancellation has been requested. The subscription stays
    # active until current_period_end, then flips to `canceled`.
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    canceled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional external billing provider ID (Stripe subscription id).
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Free-text note visible in the admin UI.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions")
    tenant: Mapped["Tenant"] = relationship("Tenant")

    __table_args__ = (
        # Exactly one active subscription per tenant.
        Index(
            "uq_subscriptions_tenant_active",
            "tenant_id",
            unique=True,
            postgresql_where=text("status IN ('active', 'trialing')"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Subscription tenant={self.tenant_id} plan={self.plan_id} {self.status}>"

    @property
    def is_active(self) -> bool:
        return self.status in (STATUS_ACTIVE, STATUS_TRIALING)
