from sqlalchemy import BigInteger, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import UserStatus


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    telegram_id_encrypted: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    telegram_id_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.active, index=True)
    internal_seq: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all,delete-orphan")
