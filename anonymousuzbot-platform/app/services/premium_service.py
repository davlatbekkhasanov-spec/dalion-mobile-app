from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.redis import redis_client
from app.models.user import User
from app.repositories.setting_repository import SettingRepository
from app.repositories.user_repository import UserRepository
from app.services.nickname_service import generate_premium_nickname


class PremiumService:
    LIKES_KEY_PREFIX = "likes:user:"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.setting_repo = SettingRepository(session)

    @staticmethod
    def is_premium(user: User) -> bool:
        if user.premium_until is None:
            return False
        now = datetime.now(UTC)
        until = user.premium_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=UTC)
        return until > now

    async def refresh_premium_state(self, user: User) -> User:
        if user.premium_until is None:
            return user
        if not self.is_premium(user):
            return await self.user_repo.update(user, premium_until=None)
        return user

    async def grant_days(self, user_id: UUID, days: int) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        now = datetime.now(UTC)
        base = user.premium_until if self.is_premium(user) else now
        if base.tzinfo is None:
            base = base.replace(tzinfo=UTC)
        updated = await self.user_repo.update(
            user,
            premium_until=base + timedelta(days=days),
            anonymous_nick=generate_premium_nickname(),
        )
        return updated

    async def get_likes_limit(self, user: User) -> int:
        key = "premium.likes_per_day_premium" if self.is_premium(user) else "premium.likes_per_day_free"
        default = "30" if self.is_premium(user) else "5"
        setting = await self.setting_repo.get(key)
        try:
            return int(setting.value if setting else default)
        except ValueError:
            return 30 if self.is_premium(user) else 5

    def _likes_key(self, user_id: UUID) -> str:
        day = datetime.now(UTC).strftime("%Y%m%d")
        return f"{self.LIKES_KEY_PREFIX}{user_id}:{day}"

    async def get_likes_used_today(self, user_id: UUID) -> int:
        raw = await redis_client.get(self._likes_key(user_id))
        return int(raw or 0)

    async def can_like_today(self, user: User) -> bool:
        used = await self.get_likes_used_today(user.id)
        return used < await self.get_likes_limit(user)

    async def record_like(self, user_id: UUID) -> None:
        key = self._likes_key(user_id)
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, 86400)

    async def get_status_text(self, user: User) -> str:
        user = await self.refresh_premium_state(user)
        if self.is_premium(user):
            until = user.premium_until
            if until and until.tzinfo is None:
                until = until.replace(tzinfo=UTC)
            date_str = until.strftime("%Y-%m-%d") if until else "—"
            return (
                "💎 Premium faol\n"
                f"⏳ Amal qiladi: {date_str}\n\n"
                "✨ Ustuvor matchmaking\n"
                "🎭 Eksklyuziv nicklar\n"
                "❤️ Ko‘proq like\n"
                "✨ Maxsus match effektlari"
            )
        return (
            "⭐️ Premium yo‘q\n\n"
            "Premium imkoniyatlari:\n"
            "✨ Ustuvor matchmaking\n"
            "🎭 Eksklyuziv nicklar\n"
            "❤️ Ko‘proq like\n"
            "✨ Maxsus match effektlari\n"
            "🎁 Referral bonus"
        )
