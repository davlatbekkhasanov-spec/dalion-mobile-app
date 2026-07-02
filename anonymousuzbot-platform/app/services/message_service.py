from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatSession
from app.models.enums import MessageTypeEnum
from app.models.user import User
from app.services.ai_moderator_service import AIModeratorService
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.user_repository import UserRepository


class MessageService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.chat_repo = ChatSessionRepository(session)
        self.message_repo = MessageRepository(session)
        self.user_repo = UserRepository(session)

    async def get_active_chat(self, user_id) -> ChatSession | None:
        return await self.chat_repo.get_active_for_user(user_id)

    async def get_partner(self, chat: ChatSession, user_id) -> User | None:
        partner_id = chat.female_user_id if chat.male_user_id == user_id else chat.male_user_id
        return await self.user_repo.get_by_id(partner_id)

    async def save_message(
        self,
        chat_id,
        sender_id,
        message_type: MessageTypeEnum,
        text: str | None,
        telegram_file_id: str | None,
    ):
        message = await self.message_repo.create(
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=message_type,
            text=text,
            telegram_file_id=telegram_file_id,
        )
        await AIModeratorService(self.session).analyze_saved_message(message)
        return message

    async def relay_message(
        self,
        *,
        chat: ChatSession,
        sender: User,
        message_type: MessageTypeEnum,
        text: str | None,
        telegram_file_id: str | None,
    ) -> User | None:
        partner = await self.get_partner(chat, sender.id)
        if partner is None:
            return None

        await self.save_message(
            chat_id=chat.id,
            sender_id=sender.id,
            message_type=message_type,
            text=text,
            telegram_file_id=telegram_file_id,
        )
        return partner
