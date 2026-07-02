from datetime import UTC, datetime
from uuid import UUID

from aiogram import Bot
from redis.asyncio.client import Lock
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.keyboards.main import chat_control_keyboard
from app.database.redis import redis_client
from app.models.chat_session import ChatSession
from app.models.enums import ChatStatusEnum, GenderEnum
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.user_repository import UserRepository


class MatchmakingService:
    MALE_QUEUE = "queue:male"
    FEMALE_QUEUE = "queue:female"
    ONLINE_PREFIX = "online:user:"
    LOCK_KEY = "lock:matchmaking"

    def __init__(self, session: AsyncSession, bot: Bot | None = None) -> None:
        self.session = session
        self.bot = bot
        self.user_repo = UserRepository(session)
        self.chat_repo = ChatSessionRepository(session)

    def _queue_for_gender(self, gender: GenderEnum) -> str:
        return self.MALE_QUEUE if gender == GenderEnum.male else self.FEMALE_QUEUE

    def _opposite_queue_for_gender(self, gender: GenderEnum) -> str:
        return self.FEMALE_QUEUE if gender == GenderEnum.male else self.MALE_QUEUE

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

    async def _pop_waiting_user(self, queue_key: str, current_user_id) -> User | None:
        while True:
            peer_id = await redis_client.lpop(queue_key)
            if not peer_id:
                return None
            if str(peer_id) == str(current_user_id):
                continue
            peer = await self.user_repo.get_by_id(UUID(str(peer_id)))
            if peer is None:
                continue
            if peer.is_banned or not peer.is_registered:
                continue
            if await self.chat_repo.get_active_for_user(peer.id) is not None:
                continue
            if not await self._is_online(peer):
                continue
            return peer

    async def start_search(self, user: User) -> ChatSession | None:
        if not user.is_registered:
            raise ValueError("Avval ro‘yxatdan o‘ting")
        if user.is_banned:
            raise ValueError("Siz bloklangansiz")
        if await self.chat_repo.get_active_for_user(user.id) is not None:
            raise ValueError("Siz allaqachon suhbatdasiz")

        await self.cancel_search(user)
        await self._set_online(user)

        lock = await self._acquire_lock()
        try:
            peer = await self.find_match(user)
            if peer is None:
                await redis_client.rpush(self._queue_for_gender(user.gender), str(user.id))
                return None

            chat = await self.create_chat(user, peer)
            await self.notify_match(chat)
            return chat
        finally:
            await lock.release()

    async def cancel_search(self, user: User) -> None:
        await redis_client.lrem(self.MALE_QUEUE, 0, str(user.id))
        await redis_client.lrem(self.FEMALE_QUEUE, 0, str(user.id))
        await redis_client.delete(self._online_key(user.id))

    async def find_match(self, user: User) -> User | None:
        opposite_queue = self._opposite_queue_for_gender(user.gender)
        return await self._pop_waiting_user(opposite_queue, user.id)

    async def create_chat(self, user1: User, user2: User) -> ChatSession:
        male_user = user1 if user1.gender == GenderEnum.male else user2
        female_user = user2 if user1.gender == GenderEnum.male else user1

        # Defensive guard to avoid invalid pairing.
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

        text = "🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi..."
        kb = chat_control_keyboard()
        await self.bot.send_message(chat_id=male_user.telegram_id, text=text, reply_markup=kb)
        await self.bot.send_message(chat_id=female_user.telegram_id, text=text, reply_markup=kb)
