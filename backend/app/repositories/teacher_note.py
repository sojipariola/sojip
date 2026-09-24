from uuid import UUID

from sqlalchemy import select

from app.core.repository import TenantRepository
from app.models.teacher_note import TeacherNote


class TeacherNoteRepository(TenantRepository[TeacherNote]):
    model = TeacherNote

    async def get_published_for_phase(
        self, phase: str
    ) -> TeacherNote | None:
        stmt = self._base_query().where(
            TeacherNote.phase == phase,
            TeacherNote.is_published.is_(True),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_tenant(
        self, include_drafts: bool = False
    ) -> list[TeacherNote]:
        stmt = self._base_query()
        if not include_drafts:
            stmt = stmt.where(TeacherNote.is_published.is_(True))
        stmt = stmt.order_by(TeacherNote.phase.asc(), TeacherNote.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
