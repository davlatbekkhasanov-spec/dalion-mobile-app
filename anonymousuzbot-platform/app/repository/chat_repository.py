from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatSession
from app.models.enums import ChatStatus


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_active_chat(self, user_id):
        result = await self.session.execute(
            select(ChatSession).where(
                and_(
                    ChatSession.status == ChatStatus.active,
                    or_(ChatSession.user_a_id == user_id, ChatSession.user_b_id == user_id),
                )
            )
        )
        return result.scalar_one_or_none()

    async def create_chat(self, user_a_id, user_b_id) -> ChatSession:
        chat = ChatSession(user_a_id=user_a_id, user_b_id=user_b_id)
        self.session.add(chat)
        await self.session.commit()
        await self.session.refresh(chat)
        return chat
