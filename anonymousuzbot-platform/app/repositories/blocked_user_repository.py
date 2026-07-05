from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blocked_user import BlockedUser


class BlockedUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, blocker_id, blocked_id) -> BlockedUser:
        record = BlockedUser(blocker_id=blocker_id, blocked_id=blocked_id)
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def get_pair(self, blocker_id, blocked_id) -> BlockedUser | None:
        result = await self.session.execute(
            select(BlockedUser).where(
                and_(BlockedUser.blocker_id == blocker_id, BlockedUser.blocked_id == blocked_id)
            )
        )
        return result.scalar_one_or_none()

    async def is_blocked_between(self, user1_id, user2_id) -> bool:
        result = await self.session.execute(
            select(BlockedUser.id).where(
                or_(
                    and_(BlockedUser.blocker_id == user1_id, BlockedUser.blocked_id == user2_id),
                    and_(BlockedUser.blocker_id == user2_id, BlockedUser.blocked_id == user1_id),
                )
            )
        )
        return result.scalar_one_or_none() is not None

    async def count_for_blocker(self, blocker_id) -> int:
        from sqlalchemy import func

        result = await self.session.execute(
            select(func.count(BlockedUser.id)).where(BlockedUser.blocker_id == blocker_id)
        )
        return int(result.scalar_one() or 0)
