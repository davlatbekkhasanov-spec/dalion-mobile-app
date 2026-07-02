from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ReportStatus


class ModerationCase(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    chat_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id"), index=True)
    reporter_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    reported_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    evidence_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.open, index=True)
