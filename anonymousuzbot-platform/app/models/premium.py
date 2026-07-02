from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PremiumSubscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "premium"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    starts_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    source: Mapped[str]
