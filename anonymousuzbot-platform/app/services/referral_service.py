from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.redis import redis_client
from app.models.user import User
from app.repositories.referral_repository import ReferralRepository
from app.repositories.setting_repository import SettingRepository
from app.repositories.user_repository import UserRepository
from app.services.nickname_service import generate_premium_nickname
from app.services.premium_service import PremiumService


class ReferralService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.referral_repo = ReferralRepository(session)
        self.user_repo = UserRepository(session)
        self.setting_repo = SettingRepository(session)
        self.premium_service = PremiumService(session)

    async def _required_invites(self) -> int:
        setting = await self.setting_repo.get("referral.required_invites")
        try:
            return int(setting.value if setting else "3")
        except ValueError:
            return 3

    async def _reward_days(self) -> int:
        setting = await self.setting_repo.get("referral.reward_days")
        try:
            return int(setting.value if setting else "7")
        except ValueError:
            return 7

    def build_referral_link(self, user: User, bot_username: str) -> str:
        username = bot_username.lstrip("@")
        return f"https://t.me/{username}?start=ref_{user.id}"

    async def get_stats(self, inviter: User) -> dict:
        total = await self.referral_repo.count_valid_for_inviter(inviter.id)
        unrewarded = await self.referral_repo.count_unrewarded_valid(inviter.id)
        required = await self._required_invites()
        progress = unrewarded % required
        if progress == 0 and unrewarded > 0:
            progress = required
        return {
            "total": total,
            "unrewarded": unrewarded,
            "required": required,
            "progress": progress,
        }

    async def process_new_registration(self, invited: User, referrer_id_raw: str | None) -> dict | None:
        if not referrer_id_raw:
            return None
        try:
            inviter_id = UUID(referrer_id_raw.removeprefix("ref_"))
        except ValueError:
            return None

        if inviter_id == invited.id:
            return None

        inviter = await self.user_repo.get_by_id(inviter_id)
        if inviter is None or not inviter.is_registered or inviter.is_banned:
            return None

        if invited.is_banned:
            return None

        existing = await self.referral_repo.get_by_invited_id(invited.id)
        if existing is not None:
            return None

        await self.referral_repo.create(inviter_id=inviter_id, invited_id=invited.id, reward_given=False)
        reward = await self._maybe_grant_reward(inviter_id)
        if reward:
            return {"inviter_id": inviter_id, "days": reward}
        return None

    async def _maybe_grant_reward(self, inviter_id: UUID) -> int | None:
        required = await self._required_invites()
        batch = await self.referral_repo.list_unrewarded_valid(inviter_id, limit=required)
        if len(batch) < required:
            return None

        days = await self._reward_days()
        await self.premium_service.grant_days(inviter_id, days)
        await self.referral_repo.mark_rewarded(batch)
        return days
