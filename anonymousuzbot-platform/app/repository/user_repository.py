import hashlib
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encrypt_telegram_id
from app.models.enums import Gender
from app.models.profile import UserProfile
from app.models.user import User

ADJECTIVES = ["Black", "Neon", "Silent", "Shadow", "Crimson", "Velvet", "Cyber", "Night"]
ANIMALS = ["Wolf", "Falcon", "Tiger", "Panther", "Fox", "Raven", "Lynx", "Viper"]


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_telegram_id(self, telegram_id: int) -> User | None:
        digest = hashlib.sha256(str(telegram_id).encode("utf-8")).hexdigest()
        result = await self.session.execute(select(User).where(User.telegram_id_hash == digest))
        return result.scalar_one_or_none()

    async def create_user(self, telegram_id: int, gender: Gender, age: int) -> User:
        digest = hashlib.sha256(str(telegram_id).encode("utf-8")).hexdigest()
        user = User(telegram_id_encrypted=encrypt_telegram_id(telegram_id), telegram_id_hash=digest)
        nickname = f"{random.choice(ADJECTIVES)} {random.choice(ANIMALS)}"
        profile = UserProfile(user=user, nickname=nickname, gender=gender, age=age)
        self.session.add_all([user, profile])
        await self.session.commit()
        await self.session.refresh(user)
        return user
