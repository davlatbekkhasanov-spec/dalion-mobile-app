from sqlalchemy import Enum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin
from app.models.enums import SignalSeverityEnum, SignalStatusEnum, SignalTypeEnum


class ModerationSignal(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "moderation_signals"
    __table_args__ = (
        Index("ix_moderation_signals_severity_status", "severity", "status"),
        Index("ix_moderation_signals_user_created_at", "user_id", "created_at"),
    )

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    chat_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=True, index=True)
    message_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True, index=True)
    signal_type: Mapped[SignalTypeEnum] = mapped_column(Enum(SignalTypeEnum, name="signal_type_enum"), index=True)
    severity: Mapped[SignalSeverityEnum] = mapped_column(Enum(SignalSeverityEnum, name="signal_severity_enum"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[SignalStatusEnum] = mapped_column(
        Enum(SignalStatusEnum, name="signal_status_enum"),
        default=SignalStatusEnum.new,
        index=True,
    )
