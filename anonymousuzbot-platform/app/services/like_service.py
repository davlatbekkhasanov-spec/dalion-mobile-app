from app.models.chat_session import ChatSession
from app.models.user import User
from app.repositories.secret_match_repository import SecretMatchRepository
from app.services.premium_service import PremiumService


class LikeService:
    def __init__(self, session) -> None:
        self.session = session
        self.secret_repo = SecretMatchRepository(session)
        self.premium_service = PremiumService(session)

    async def add_like(self, chat: ChatSession, user: User) -> tuple[bool, str | None]:
        if not await self.premium_service.can_like_today(user):
            limit = await self.premium_service.get_likes_limit(user)
            return False, f"Kunlik like limiti tugadi ({limit})"

        if chat.male_user_id == user.id:
            if chat.male_liked:
                return False, "Siz allaqachon like bosgansiz"
            chat.male_liked = True
        elif chat.female_user_id == user.id:
            if chat.female_liked:
                return False, "Siz allaqachon like bosgansiz"
            chat.female_liked = True
        else:
            return False, "Faol chat yo‘q"

        await self.premium_service.record_like(user.id)
        await self.session.commit()
        await self.session.refresh(chat)

        if chat.male_liked and chat.female_liked:
            existing = await self.secret_repo.get_by_chat_id(chat.id)
            if existing is None:
                await self.secret_repo.create(
                    chat_id=chat.id,
                    user1_id=chat.male_user_id,
                    user2_id=chat.female_user_id,
                )
            return True, None
        return False, None
