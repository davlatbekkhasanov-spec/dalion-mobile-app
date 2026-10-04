from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, select
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

    async def count_recent_by_sender(self, sender_id: UUID, since: datetime) -> int:
        result = await self.session.execute(
            select(func.count(Message.id)).where(
                Message.sender_id == sender_id,
                Message.created_at >= since,
            )
        )
        return int(result.scalar_one() or 0)

    async def count_same_text_recent(self, sender_id: UUID, text: str, since: datetime) -> int:
        normalized = " ".join(text.lower().split())
        result = await self.session.execute(
            select(func.count(Message.id)).where(
                Message.sender_id == sender_id,
                Message.text.is_not(None),
                func.lower(Message.text) == normalized,
                Message.created_at >= since,
            )
        )
        return int(result.scalar_one() or 0)

    async def count_distinct_chats_same_text(self, sender_id: UUID, text: str, since: datetime) -> int:
        normalized = " ".join(text.lower().split())
        result = await self.session.execute(
            select(func.count(func.distinct(Message.chat_id))).where(
                Message.sender_id == sender_id,
                Message.text.is_not(None),
                func.lower(Message.text) == normalized,
                Message.created_at >= since,
            )
        )
        return int(result.scalar_one() or 0)
