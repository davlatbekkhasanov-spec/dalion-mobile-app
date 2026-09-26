from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class SecretMatch(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "secret_matches"
    __table_args__ = (UniqueConstraint("chat_id", name="uq_secret_match_chat"),)

    chat_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), index=True)
    user1_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    user2_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)

    chat = relationship("ChatSession", back_populates="secret_match")
