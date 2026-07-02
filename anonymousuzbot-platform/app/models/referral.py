from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Referral(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "referrals"

    inviter_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    invited_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
