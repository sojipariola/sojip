from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.tenant import Tenant


ROLES = ("student", "teacher", "innovator", "admin")
SKILL_TIERS = (
    "beginner", "intermediate", "advanced",
    "expert", "professional", "veteran",
)


class User(Base, UUIDMixin, TimestampMixin):
    """
    A User belongs to exactly one Tenant.

    `role` and `skill_tier` determine which UI complexity they see,
    which games are unlocked, how much AI assistance they receive,
    and what permissions they have on projects.
    """
    __tablename__ = "users"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="student", server_default="student"
    )
    skill_tier: Mapped[str] = mapped_column(
        String(50), nullable=False, default="beginner", server_default="beginner"
    )

    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    # GitHub OAuth
    github_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="users")
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan",
        foreign_keys="Project.owner_id",
    )

    def __repr__(self) -> str:
        return f"<User {self.email} role={self.role} tier={self.skill_tier}>"
