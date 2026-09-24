from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.remark import Remark


class Artifact(Base, UUIDMixin, TimestampMixin):
    """
    A versioned artifact produced during a project phase.

    Every phase produces one or more artifacts:
      - idea       → lean_canvas
      - plan       → task_graph
      - blueprint  → system_diagram
      - scaffold   → (no artifact; produces a repo)
      - development→ (no artifact; the code IS the artifact)
      - maintenance→ retrospective, release_log

    A project always has exactly one *current* artifact per kind.
    Historical versions are also Artifact rows where is_current=False.

    The `data` field is loose JSON — its shape is enforced by Pydantic
    schemas at the API boundary, not by the database.
    """
    __tablename__ = "artifacts"

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

    phase: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true", index=True
    )

    locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    locked_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    project: Mapped["Project"] = relationship(
        "Project", back_populates="artifacts"
    )
    remarks: Mapped[list["Remark"]] = relationship(
        "Remark",
        back_populates="artifact",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # Partial unique index: exactly one current artifact per (project, kind).
        # PostgreSQL partial indexes require an Index, not a UniqueConstraint.
        Index(
            "uq_artifacts_project_kind_current",
            "project_id",
            "kind",
            unique=True,
            postgresql_where=text("is_current = true"),
        ),
    )

    @property
    def is_locked(self) -> bool:
        return self.locked_at is not None

    def __repr__(self) -> str:
        return (
            f"<Artifact {self.kind} v{self.version} "
            f"current={self.is_current} locked={self.is_locked}>"
        )
