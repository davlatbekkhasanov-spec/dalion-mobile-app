from aiogram import Bot

from app.models.enums import ChatStatusEnum
from app.models.user import User
from app.repositories.chat_session_repository import ChatSessionRepository
from app.services.matchmaking_service import MatchmakingService


class ChatControlService:
    def __init__(self, session, bot: Bot | None = None) -> None:
        self.session = session
        self.bot = bot
        self.chat_repo = ChatSessionRepository(session)

    async def end_chat(self, user: User):
        chat = await self.chat_repo.get_active_for_user(user.id)
        if chat is None:
            return None, None

        partner_id = chat.female_user_id if chat.male_user_id == user.id else chat.male_user_id
        chat = await self.chat_repo.set_status(chat, ChatStatusEnum.ended)

        matchmaking = MatchmakingService(self.session, bot=self.bot)
        partner = await matchmaking.user_repo.get_by_id(partner_id)
        await matchmaking.cancel_search(user)
        if partner is not None:
            await matchmaking.cancel_search(partner)
        return chat, partner
