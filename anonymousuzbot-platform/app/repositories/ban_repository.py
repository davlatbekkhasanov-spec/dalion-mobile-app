from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ban import Ban
from app.models.enums import BanTypeEnum


class BanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> Ban:
        ban = Ban(**kwargs)
        self.session.add(ban)
        await self.session.commit()
        await self.session.refresh(ban)
        return ban

    async def get_by_id(self, ban_id: UUID) -> Ban | None:
        result = await self.session.execute(select(Ban).where(Ban.id == ban_id))
        return result.scalar_one_or_none()

    async def list_active(self, limit: int = 100) -> list[Ban]:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(Ban)
            .where(
                or_(
                    Ban.type == BanTypeEnum.permanent,
                    and_(Ban.until.is_not(None), Ban.until > now),
                )
            )
            .order_by(Ban.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_expired(self, limit: int = 100) -> list[Ban]:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(Ban)
            .where(Ban.type == BanTypeEnum.temporary, Ban.until.is_not(None), Ban.until <= now)
            .order_by(Ban.until.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_active_for_user(self, user_id: UUID) -> Ban | None:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(Ban)
            .where(Ban.user_id == user_id)
            .where(
                or_(
                    Ban.type == BanTypeEnum.permanent,
                    and_(Ban.until.is_not(None), Ban.until > now),
                )
            )
            .order_by(Ban.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
