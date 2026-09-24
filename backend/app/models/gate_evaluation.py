from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class GateEvaluation(Base, UUIDMixin, TimestampMixin):
    """
    A log of every gate evaluation attempt.

    Useful for:
      - Analytics: how many students fail each gate?
      - Debugging: what did the AI say at a specific moment?
      - History: when did a project advance?
    """
    __tablename__ = "gate_evaluations"

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
    evaluated_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    gate: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)

    missing: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    ai_feedback: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    peer_validation_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    project: Mapped["Project"] = relationship("Project")
    evaluator: Mapped["User | None"] = relationship("User")

    def __repr__(self) -> str:
        return f"<GateEvaluation {self.gate} passed={self.passed}>"
