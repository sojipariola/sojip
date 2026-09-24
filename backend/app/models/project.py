from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.artifact import Artifact
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.validation import PeerValidation


class Project(Base, UUIDMixin, TimestampMixin):
    """
    A Project is the core unit of work in SOJIP.

    Phase-specific content is stored in Artifact rows, not on the
    Project itself. A project's `current_phase` tells you which
    artifact kind to load.
    """
    __tablename__ = "projects"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    current_phase: Mapped[str] = mapped_column(
        String(50), nullable=False, default="idea", server_default="idea"
    )

    github_repo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Per-project override of the tenant's gate policy.
    # NULL means "inherit from tenant".
    gate_policy_override: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="projects")
    owner: Mapped["User"] = relationship(
        "User", back_populates="projects", foreign_keys=[owner_id]
    )
    validations: Mapped[list["PeerValidation"]] = relationship(
        "PeerValidation",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Project {self.slug} phase={self.current_phase}>"
