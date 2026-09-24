from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant_context import TenantContext
from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class TenantRepository(Generic[ModelT]):
    """
    Base repository that automatically filters by tenant_id.

    Every query starts with `_base_query()` and inherits the tenant
    filter. Subclasses can add specific queries but MUST go through
    `_base_query()`.
    """
    model: type[ModelT]

    def __init__(self, db: AsyncSession, ctx: TenantContext):
        self.db = db
        self.ctx = ctx

    def _base_query(self):
        return select(self.model).where(
            self.model.tenant_id == self.ctx.tenant_id  # type: ignore[attr-defined]
        )

    async def get_by_id(self, id: UUID) -> ModelT | None:
        stmt = self._base_query().where(self.model.id == id)  # type: ignore[attr-defined]
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, limit: int = 100, offset: int = 0) -> list[ModelT]:
        stmt = self._base_query().limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> ModelT:
        instance = self.model(
            tenant_id=self.ctx.tenant_id,  # type: ignore[call-arg]
            **kwargs,
        )
        self.db.add(instance)
        await self.db.flush()
        return instance
