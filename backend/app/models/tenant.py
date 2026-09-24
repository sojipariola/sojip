from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.project import Project


class Tenant(Base, UUIDMixin, TimestampMixin):
    """
    A Tenant is an institution, school, or organization.

    Every piece of tenant-scoped data (users, projects, validations)
    references a Tenant. Isolation is enforced at the query layer in v1,
    with PostgreSQL RLS added as defense-in-depth in v2.
    """
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    tier: Mapped[str] = mapped_column(
        String(50), nullable=False, default="free", server_default="free"
    )
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    # Gate policy: "flexible" allows advancing without locking; "strict"
    # requires the artifact to be locked before a gate can pass.
    gate_policy: Mapped[str] = mapped_column(
        String(20), nullable=False, default="flexible", server_default="flexible"
    )

    users: Mapped[list["User"]] = relationship(
        "User", back_populates="tenant", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tenant {self.slug}>"
