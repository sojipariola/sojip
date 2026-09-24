"""
Scaffold job model.

Tracks the async process of generating a GitHub repository from a
Blueprint. One row per generation attempt.

The job state machine:
  queued → running → completed
                  → failed

`progress` is a 0-100 integer. `current_stage` names the current step
("generating_files", "creating_repo", "pushing_commit", "configuring_ci").
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


class ScaffoldJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scaffold_jobs"

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
    created_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    template_id: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued", server_default="queued"
    )
    progress: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    current_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)

    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    repo_full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    log: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project: Mapped["Project"] = relationship("Project")

    def __repr__(self) -> str:
        return (
            f"<ScaffoldJob {self.status} {self.progress}% "
            f"{self.template_id}>"
        )
