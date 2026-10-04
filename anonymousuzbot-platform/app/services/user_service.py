from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import GenderEnum, LanguageEnum
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.nickname_service import generate_anonymous_nickname


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repository = UserRepository(session)

    async def get_or_create_unregistered(self, telegram_id: int) -> User:
        user = await self.user_repository.get_by_telegram_id(telegram_id)
        if user is not None:
            return user

        return await self.user_repository.create(
            telegram_id=telegram_id,
            gender=GenderEnum.male,
            language=LanguageEnum.uz,
            age=18,
            anonymous_nick=generate_anonymous_nickname(),
            is_registered=False,
            is_active=True,
            is_banned=False,
            last_seen_at=datetime.now(UTC),
        )

    async def complete_registration(
        self,
        user: User,
        gender: GenderEnum,
        age: int,
        language: LanguageEnum = LanguageEnum.uz,
    ) -> User:
        return await self.user_repository.update(
            user,
            gender=gender,
            age=age,
            language=language,
            anonymous_nick=generate_anonymous_nickname(),
            is_registered=True,
            is_active=True,
            is_banned=False,
            last_seen_at=datetime.now(UTC),
        )

    async def update_gender(self, user: User, gender: GenderEnum) -> User:
        return await self.user_repository.update(user, gender=gender, last_seen_at=datetime.now(UTC))

    async def update_age(self, user: User, age: int) -> User:
        return await self.user_repository.update(user, age=age, last_seen_at=datetime.now(UTC))

    async def update_language(self, user: User, language: LanguageEnum) -> User:
        return await self.user_repository.update(user, language=language, last_seen_at=datetime.now(UTC))
