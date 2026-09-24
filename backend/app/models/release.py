"""
Release model.

A release is a shipped version of the project. Every release has a
version tag (v1.0.0 style), a severity, and a written changelog.

Releases are the concrete evidence that the student has iterated —
the discipline that separates "I built something" from "I shipped
something."
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


# Severity levels — mirrors semantic versioning conventions
SEVERITIES = ("patch", "minor", "major")


class Release(Base, UUIDMixin, TimestampMixin):
    """
    A single release of a project.
    """
    __tablename__ = "releases"

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

    # Version tag — "v0.1.0", "v1.0.0", or "1.0.0" style
    version_tag: Mapped[str] = mapped_column(String(50), nullable=False)

    # Severity: patch | minor | major
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="minor", server_default="minor"
    )

    # The changelog entry — the student's own words
    changelog: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional: link to a specific commit
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # When the release was marked as shipped
    deployed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project: Mapped["Project"] = relationship("Project")
    author: Mapped["User | None"] = relationship("User")

    def __repr__(self) -> str:
        return f"<Release {self.version_tag} ({self.severity})>"
