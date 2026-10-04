from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AdminRoleEnum


class AdminUser(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "admin_users"

    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[AdminRoleEnum] = mapped_column(Enum(AdminRoleEnum, name="admin_role_enum"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
