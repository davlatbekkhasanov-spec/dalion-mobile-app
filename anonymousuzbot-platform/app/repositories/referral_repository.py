from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.referral import Referral
from app.models.user import User


class ReferralRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> Referral:
        referral = Referral(**kwargs)
        self.session.add(referral)
        await self.session.commit()
        await self.session.refresh(referral)
        return referral

    async def get_by_invited_id(self, invited_id: UUID) -> Referral | None:
        result = await self.session.execute(select(Referral).where(Referral.invited_id == invited_id))
        return result.scalar_one_or_none()

    async def count_valid_for_inviter(self, inviter_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count(Referral.id))
            .join(User, User.id == Referral.invited_id)
            .where(
                Referral.inviter_id == inviter_id,
                User.is_registered.is_(True),
                User.is_banned.is_(False),
            )
        )
        return int(result.scalar_one() or 0)

    async def count_unrewarded_valid(self, inviter_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count(Referral.id))
            .join(User, User.id == Referral.invited_id)
            .where(
                Referral.inviter_id == inviter_id,
                Referral.reward_given.is_(False),
                User.is_registered.is_(True),
                User.is_banned.is_(False),
            )
        )
        return int(result.scalar_one() or 0)

    async def list_unrewarded_valid(self, inviter_id: UUID, limit: int = 3) -> list[Referral]:
        result = await self.session.execute(
            select(Referral)
            .join(User, User.id == Referral.invited_id)
            .where(
                Referral.inviter_id == inviter_id,
                Referral.reward_given.is_(False),
                User.is_registered.is_(True),
                User.is_banned.is_(False),
            )
            .order_by(Referral.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def mark_rewarded(self, referrals: list[Referral]) -> None:
        for referral in referrals:
            referral.reward_given = True
        await self.session.commit()
