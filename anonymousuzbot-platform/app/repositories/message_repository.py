from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> Message:
        message = Message(**kwargs)
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def get_by_id(self, message_id: UUID) -> Message | None:
        result = await self.session.execute(select(Message).where(Message.id == message_id))
        return result.scalar_one_or_none()

    async def list_by_chat(self, chat_id: UUID, limit: int = 100) -> list[Message]:
        result = await self.session.execute(
            select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())
