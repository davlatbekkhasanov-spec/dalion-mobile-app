from datetime import UTC, datetime
from uuid import UUID

from aiogram import Bot
from redis.asyncio.client import Lock
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import chat_control_keyboard
from app.database.redis import redis_client
from app.models.chat_session import ChatSession
from app.models.enums import ChatStatusEnum, GenderEnum
from app.models.user import User
from app.repositories.blocked_user_repository import BlockedUserRepository
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.user_repository import UserRepository
from app.services.premium_service import PremiumService


class MatchmakingService:
    MALE_QUEUE = "queue:male"
    FEMALE_QUEUE = "queue:female"
    PREMIUM_MALE_QUEUE = "queue:premium:male"
    PREMIUM_FEMALE_QUEUE = "queue:premium:female"
    ONLINE_PREFIX = "online:user:"
    LOCK_KEY = "lock:matchmaking"

    def __init__(self, session: AsyncSession, bot: Bot | None = None) -> None:
        self.session = session
        self.bot = bot
        self.user_repo = UserRepository(session)
        self.chat_repo = ChatSessionRepository(session)
        self.blocked_repo = BlockedUserRepository(session)
        self.premium_service = PremiumService(session)

    def _queue_for_gender(self, gender: GenderEnum, premium: bool = False) -> str:
        if premium:
            return self.PREMIUM_MALE_QUEUE if gender == GenderEnum.male else self.PREMIUM_FEMALE_QUEUE
        return self.MALE_QUEUE if gender == GenderEnum.male else self.FEMALE_QUEUE

    def _opposite_queues_for_gender(self, gender: GenderEnum) -> list[str]:
        if gender == GenderEnum.male:
            return [self.PREMIUM_FEMALE_QUEUE, self.FEMALE_QUEUE]
        return [self.PREMIUM_MALE_QUEUE, self.MALE_QUEUE]

    def _own_queues_for_user(self, user: User) -> list[str]:
        premium = PremiumService.is_premium(user)
        if premium:
            return [self._queue_for_gender(user.gender, premium=True)]
        return [self._queue_for_gender(user.gender, premium=False)]

    def _online_key(self, user_id) -> str:
        return f"{self.ONLINE_PREFIX}{user_id}"

    async def _set_online(self, user: User) -> None:
        await redis_client.set(self._online_key(user.id), "1", ex=180)

    async def _is_online(self, user: User) -> bool:
        return bool(await redis_client.exists(self._online_key(user.id)))

    async def _acquire_lock(self) -> Lock:
        lock = redis_client.lock(self.LOCK_KEY, timeout=5, blocking_timeout=5)
        await lock.acquire()
        return lock

    async def _pop_waiting_user(self, queue_key: str, current_user: User) -> User | None:
        while True:
            peer_id = await redis_client.lpop(queue_key)
            if not peer_id:
                return None
            if str(peer_id) == str(current_user.id):
                continue
            peer = await self.user_repo.get_by_id(UUID(str(peer_id)))
            if peer is None:
                continue
            if peer.is_banned or not peer.is_registered:
                continue
            if await self.blocked_repo.is_blocked_between(current_user.id, peer.id):
                continue
            if await self.chat_repo.get_active_for_user(peer.id) is not None:
                continue
            if not await self._is_online(peer):
                continue
            return peer

    async def start_search(self, user: User, lang: str = "uz") -> ChatSession | None:
        user = await self.premium_service.refresh_premium_state(user)
        if not user.is_registered:
            raise ValueError(t("register_first", lang))
        if user.is_banned:
            raise ValueError(t("you_are_banned", lang))
        if await self.chat_repo.get_active_for_user(user.id) is not None:
            raise ValueError(t("already_in_chat", lang))

        await self.cancel_search(user)
        await self._set_online(user)

        lock = await self._acquire_lock()
        try:
            peer = await self.find_match(user)
            if peer is None:
                premium = PremiumService.is_premium(user)
                queue = self._queue_for_gender(user.gender, premium=premium)
                if premium:
                    await redis_client.lpush(queue, str(user.id))
                else:
                    await redis_client.rpush(queue, str(user.id))
                return None

            chat = await self.create_chat(user, peer)
            await self.notify_match(chat)
            return chat
        finally:
            await lock.release()

    async def cancel_search(self, user: User) -> None:
        for queue in (
            self.MALE_QUEUE,
            self.FEMALE_QUEUE,
            self.PREMIUM_MALE_QUEUE,
            self.PREMIUM_FEMALE_QUEUE,
        ):
            await redis_client.lrem(queue, 0, str(user.id))
        await redis_client.delete(self._online_key(user.id))

    async def find_match(self, user: User) -> User | None:
        for queue in self._opposite_queues_for_gender(user.gender):
            peer = await self._pop_waiting_user(queue, user)
            if peer is not None:
                return peer
        return None

    async def create_chat(self, user1: User, user2: User) -> ChatSession:
        male_user = user1 if user1.gender == GenderEnum.male else user2
        female_user = user2 if user1.gender == GenderEnum.male else user1

        if male_user.gender != GenderEnum.male or female_user.gender != GenderEnum.female:
            raise ValueError("Noto‘g‘ri juftlik")

        chat = await self.chat_repo.create(
            male_user_id=male_user.id,
            female_user_id=female_user.id,
            status=ChatStatusEnum.active,
            started_at=datetime.now(UTC),
        )
        return chat

    async def notify_match(self, chat: ChatSession) -> None:
        if self.bot is None:
            return

        male_user = await self.user_repo.get_by_id(chat.male_user_id)
        female_user = await self.user_repo.get_by_id(chat.female_user_id)
        if male_user is None or female_user is None:
            return

        premium_match = PremiumService.is_premium(male_user) or PremiumService.is_premium(female_user)
        for user in (male_user, female_user):
            lang = normalize_lang(user.language)
            text = t("premium_match_found" if premium_match else "match_found", lang)
            kb = chat_control_keyboard(lang)
            await self.bot.send_message(chat_id=user.telegram_id, text=text, reply_markup=kb)
