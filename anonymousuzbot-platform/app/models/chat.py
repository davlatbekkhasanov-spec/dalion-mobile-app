from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ChatStatus


class ChatSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "chats"

    user_a_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    user_b_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    status: Mapped[ChatStatus] = mapped_column(Enum(ChatStatus), default=ChatStatus.active, index=True)
    user_a_liked: Mapped[bool] = mapped_column(default=False)
    user_b_liked: Mapped[bool] = mapped_column(default=False)
    secret_match: Mapped[bool] = mapped_column(default=False, index=True)
