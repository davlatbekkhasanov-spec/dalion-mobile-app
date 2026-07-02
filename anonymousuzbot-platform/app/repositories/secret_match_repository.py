from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.secret_match import SecretMatch


class SecretMatchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_chat_id(self, chat_id) -> SecretMatch | None:
        result = await self.session.execute(select(SecretMatch).where(SecretMatch.chat_id == chat_id))
        return result.scalar_one_or_none()

    async def create(self, chat_id, user1_id, user2_id) -> SecretMatch:
        match = SecretMatch(chat_id=chat_id, user1_id=user1_id, user2_id=user2_id)
        self.session.add(match)
        await self.session.commit()
        await self.session.refresh(match)
        return match
