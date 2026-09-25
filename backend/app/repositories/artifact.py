from uuid import UUID

from app.core.repository import TenantRepository
from app.models.artifact import Artifact


class ArtifactRepository(TenantRepository[Artifact]):
    model = Artifact

    async def get_current(
        self, project_id: UUID, kind: str
    ) -> Artifact | None:
        stmt = self._base_query().where(
            Artifact.project_id == project_id,
            Artifact.kind == kind,
            Artifact.is_current.is_(True),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_versions(
        self, project_id: UUID, kind: str
    ) -> list[Artifact]:
        stmt = (
            self._base_query()
            .where(
                Artifact.project_id == project_id,
                Artifact.kind == kind,
            )
            .order_by(Artifact.version.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
