from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin
from app.models.enums import ChatStatusEnum


class ChatSession(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("ix_chat_sessions_status_created_at", "status", "created_at"),
    )

    male_user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    female_user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    status: Mapped[ChatStatusEnum] = mapped_column(
        Enum(ChatStatusEnum, name="chat_status_enum"),
        default=ChatStatusEnum.searching,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    male_user = relationship("User", foreign_keys=[male_user_id], back_populates="male_chats")
    female_user = relationship("User", foreign_keys=[female_user_id], back_populates="female_chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="chat", cascade="all, delete-orphan")
