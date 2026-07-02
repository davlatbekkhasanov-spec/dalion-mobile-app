from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.premium import PremiumSubscription
from app.models.referral import Referral


class PremiumService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def grant_referral_bonus_if_eligible(self, inviter_id):
        count = (
            await self.session.execute(
                select(func.count(Referral.id)).where(Referral.inviter_id == inviter_id)
            )
        ).scalar_one()
        if count < settings.premium_referral_target:
            return None
        now = datetime.now(UTC)
        premium = PremiumSubscription(
            user_id=inviter_id,
            starts_at=now,
            expires_at=now + timedelta(days=settings.premium_referral_days),
            source="referral",
        )
        self.session.add(premium)
        await self.session.commit()
        return premium
