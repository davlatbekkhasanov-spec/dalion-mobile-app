from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import Gender


class UserProfile(TimestampMixin, Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(64), index=True)
    gender: Mapped[Gender] = mapped_column(Enum(Gender), index=True)
    age: Mapped[int] = mapped_column(Integer, index=True)
    exclusive_avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user = relationship("User", back_populates="profile")
