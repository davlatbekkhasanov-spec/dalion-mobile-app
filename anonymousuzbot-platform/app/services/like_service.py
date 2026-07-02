from app.models.chat_session import ChatSession
from app.repositories.secret_match_repository import SecretMatchRepository


class LikeService:
    def __init__(self, session) -> None:
        self.session = session
        self.secret_repo = SecretMatchRepository(session)

    async def add_like(self, chat: ChatSession, user_id) -> bool:
        if chat.male_user_id == user_id:
            chat.male_liked = True
        elif chat.female_user_id == user_id:
            chat.female_liked = True

        await self.session.commit()
        await self.session.refresh(chat)

        if chat.male_liked and chat.female_liked:
            existing = await self.secret_repo.get_by_chat_id(chat.id)
            if existing is None:
                await self.secret_repo.create(chat_id=chat.id, user1_id=chat.male_user_id, user2_id=chat.female_user_id)
            return True
        return False
