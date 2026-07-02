from sqlalchemy import Enum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin
from app.models.enums import MessageTypeEnum


class Message(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_chat_created_at", "chat_id", "created_at"),
    )

    chat_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), index=True)
    sender_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    message_type: Mapped[MessageTypeEnum] = mapped_column(
        Enum(MessageTypeEnum, name="message_type_enum"),
        index=True,
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_file_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    chat = relationship("ChatSession", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
