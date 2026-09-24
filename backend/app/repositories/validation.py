from uuid import UUID

from sqlalchemy import func, select

from app.core.repository import TenantRepository
from app.models.validation import PeerValidation


class PeerValidationRepository(TenantRepository[PeerValidation]):
    model = PeerValidation

    async def count_for_project(self, project_id: UUID, phase: str = "idea") -> int:
        stmt = (
            select(func.count())
            .select_from(PeerValidation)
            .where(
                PeerValidation.tenant_id == self.ctx.tenant_id,
                PeerValidation.project_id == project_id,
                PeerValidation.phase == phase,
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def exists_for_project_and_validator(
        self, project_id: UUID, validator_id: UUID, phase: str = "idea"
    ) -> bool:
        stmt = self._base_query().where(
            PeerValidation.project_id == project_id,
            PeerValidation.validator_id == validator_id,
            PeerValidation.phase == phase,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def list_for_project(
        self, project_id: UUID, phase: str = "idea"
    ) -> list[PeerValidation]:
        stmt = self._base_query().where(
            PeerValidation.project_id == project_id,
            PeerValidation.phase == phase,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
