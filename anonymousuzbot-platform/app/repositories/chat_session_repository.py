from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatSession
from app.models.enums import ChatStatusEnum


class ChatSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> ChatSession:
        chat = ChatSession(**kwargs)
        self.session.add(chat)
        await self.session.commit()
        await self.session.refresh(chat)
        return chat

    async def get_by_id(self, chat_id: UUID) -> ChatSession | None:
        result = await self.session.execute(select(ChatSession).where(ChatSession.id == chat_id))
        return result.scalar_one_or_none()

    async def get_active_for_user(self, user_id: UUID) -> ChatSession | None:
        result = await self.session.execute(
            select(ChatSession).where(
                ChatSession.status == ChatStatusEnum.active,
                or_(ChatSession.male_user_id == user_id, ChatSession.female_user_id == user_id),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_status(self, status: ChatStatusEnum) -> list[ChatSession]:
        result = await self.session.execute(select(ChatSession).where(ChatSession.status == status))
        return list(result.scalars().all())

    async def set_status(self, chat: ChatSession, status: ChatStatusEnum) -> ChatSession:
        chat.status = status
        if status == ChatStatusEnum.active and chat.started_at is None:
            chat.started_at = datetime.now(UTC)
        if status in {ChatStatusEnum.ended, ChatStatusEnum.reported}:
            chat.ended_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(chat)
        return chat
