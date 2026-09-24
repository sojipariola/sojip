from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class PeerValidation(Base, UUIDMixin, TimestampMixin):
    """
    A peer validation is a user in the same tenant confirming that a
    project's idea is specific, defensible, and worth pursuing.

    The gate requires 3 validations before a project can move from
    Idea to Plan. Validations are stored as rows so we can audit who
    validated what, when, and why.

    A user cannot validate the same project twice (enforced by a
    unique constraint on project_id + validator_id + phase).
    """
    __tablename__ = "peer_validations"

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
    validator_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    phase: Mapped[str] = mapped_column(
        String(50), nullable=False, default="idea", server_default="idea"
    )

    # Bidirectional relationships — back_populates prevents SAWarning
    project: Mapped["Project"] = relationship(
        "Project", back_populates="validations"
    )
    validator: Mapped["User"] = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "validator_id",
            "phase",
            name="uq_peer_validations_project_validator",
        ),
    )

    def __repr__(self) -> str:
        return f"<PeerValidation project={self.project_id} by={self.validator_id}>"
