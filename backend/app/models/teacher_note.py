"""
Teacher notes.

A note is a piece of teaching material — a short lesson, a set of
hints, a list of online resources — anchored to a specific SOJIP
phase. Students see the note for their current phase in the workspace
sidebar.

Notes are per-tenant, not per-project. A teacher writes one note
about the Blueprint phase and every student in their institution
sees it.
"""
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User


class TeacherNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teacher_notes"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phase: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    author_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # [{ "label": "...", "url": "...", "kind": "video|article|tool|docs|example" }]
    links: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    tenant: Mapped["Tenant"] = relationship("Tenant")
    author: Mapped["User | None"] = relationship("User")

    def __repr__(self) -> str:
        return f"<TeacherNote {self.phase} '{self.title}'>"
