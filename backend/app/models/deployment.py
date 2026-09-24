"""
Deployment model.

A deployment is an attempt (successful or not) to make the project
available at a public URL. Every attempt is a row — history is
append-only. Rollbacks create new rows that reference the deployment
they replace.

Env vars are stored encrypted. The API returns masked values by
default; a separate, audited endpoint can reveal a value on demand.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


# Where the deployment lives.
#
# Full-stack targets deploy a monorepo (frontend + backend + database).
# Standalone targets deploy a single-purpose app (HTML file, CLI, extension).
TARGETS = (
    # Full-stack
    "railway",
    "fly",
    "vercel",
    "docker",
    "codespaces",
    "custom",
    # Standalone
    "github_pages",
    "npm",
    "pypi",
    "chrome_store",
    "local_network",
    "download",
)


# How SOJIP verifies a deployment is live.
#   http       — GET the URL, expect 200-399
#   registry   — hit the registry API to confirm the package exists
#   manual     — student self-attests; we record the URL without a live check
VERIFICATION_KINDS = {
    "railway": "http",
    "fly": "http",
    "vercel": "http",
    "docker": "http",
    "codespaces": "http",
    "custom": "http",
    "github_pages": "http",
    "local_network": "http",
    "npm": "registry",
    "pypi": "registry",
    "chrome_store": "manual",
    "download": "manual",
}


def verification_kind_for(target: str) -> str:
    """Return the verification kind for a target, defaulting to http."""
    return VERIFICATION_KINDS.get(target, "http")

# Lifecycle states
STATUSES = (
    "pending",       # created, not yet attempted
    "deploying",     # in progress
    "healthy",       # URL returns 200
    "unhealthy",     # URL returns non-200
    "unreachable",   # network error, DNS failure, etc.
    "failed",        # deployment itself failed
    "rolled_back",   # superseded by a rollback
)

ENVIRONMENTS = ("production", "staging", "preview")


class Deployment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "deployments"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Where and how
    target: Mapped[str] = mapped_column(
        String(40), nullable=False, default="custom", server_default="custom"
    )
    environment: Mapped[str] = mapped_column(
        String(20), nullable=False, default="production", server_default="production"
    )
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # What was deployed
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    health_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    health_check_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    health_check_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Encrypted env vars: { "KEY": "<fernet ciphertext>", ... }
    env_vars_encrypted: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    # Frozen script (if generated)
    deploy_script: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Rollback chain
    rolled_back_from_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="SET NULL"),
        nullable=True,
    )
    rolled_back_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    deployed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project: Mapped["Project"] = relationship("Project")
    author: Mapped["User | None"] = relationship("User")

    def __repr__(self) -> str:
        return f"<Deployment {self.target} {self.status}>"
