from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser


class AdminUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> AdminUser:
        admin = AdminUser(**kwargs)
        self.session.add(admin)
        await self.session.commit()
        await self.session.refresh(admin)
        return admin

    async def get_by_id(self, admin_id: UUID) -> AdminUser | None:
        result = await self.session.execute(select(AdminUser).where(AdminUser.id == admin_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> AdminUser | None:
        result = await self.session.execute(select(AdminUser).where(AdminUser.username == username))
        return result.scalar_one_or_none()

    async def list_all(self) -> list[AdminUser]:
        result = await self.session.execute(select(AdminUser).order_by(AdminUser.created_at.desc()))
        return list(result.scalars().all())

    async def update(self, admin: AdminUser, **kwargs) -> AdminUser:
        for field, value in kwargs.items():
            setattr(admin, field, value)
        await self.session.commit()
        await self.session.refresh(admin)
        return admin

    async def count(self) -> int:
        result = await self.session.execute(select(AdminUser.id))
        return len(result.scalars().all())
