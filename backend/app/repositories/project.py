from uuid import UUID

from app.core.repository import TenantRepository
from app.models.project import Project


class ProjectRepository(TenantRepository[Project]):
    model = Project

    async def list_by_owner(self, owner_id: UUID) -> list[Project]:
        stmt = self._base_query().where(Project.owner_id == owner_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_phase(self, phase: str) -> list[Project]:
        stmt = self._base_query().where(Project.current_phase == phase)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def slug_exists(self, slug: str) -> bool:
        stmt = self._base_query().where(Project.slug == slug)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None
