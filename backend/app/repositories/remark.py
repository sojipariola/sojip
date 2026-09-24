from uuid import UUID

from sqlalchemy import select

from app.core.repository import TenantRepository
from app.models.remark import Remark


class RemarkRepository(TenantRepository[Remark]):
    model = Remark

    async def list_for_project(
        self, project_id: UUID, field_path: str | None = None
    ) -> list[Remark]:
        stmt = self._base_query().where(Remark.project_id == project_id)
        if field_path:
            stmt = stmt.where(Remark.field_path == field_path)
        stmt = stmt.order_by(Remark.created_at.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, id: UUID) -> Remark | None:
        return await super().get_by_id(id)
