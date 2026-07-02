from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Gender
from app.models.profile import UserProfile
from app.repository.chat_repository import ChatRepository
from app.services.redis_client import redis_client


class MatchmakingService:
    MALE_QUEUE = "match:q:male"
    FEMALE_QUEUE = "match:q:female"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.chat_repo = ChatRepository(session)

    async def enqueue_or_match(self, user_id):
        profile = (
            await self.session.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        ).scalar_one()

        if profile.gender == Gender.male:
            peer = await redis_client.lpop(self.FEMALE_QUEUE)
            if peer is None:
                await redis_client.rpush(self.MALE_QUEUE, str(user_id))
                return None
        else:
            peer = await redis_client.lpop(self.MALE_QUEUE)
            if peer is None:
                await redis_client.rpush(self.FEMALE_QUEUE, str(user_id))
                return None

        chat = await self.chat_repo.create_chat(user_id, UUID(peer))
        return chat

    async def remove_from_queue(self, user_id):
        user_key = str(user_id)
        await redis_client.lrem(self.MALE_QUEUE, 0, user_key)
        await redis_client.lrem(self.FEMALE_QUEUE, 0, user_key)
