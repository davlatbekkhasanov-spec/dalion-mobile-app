from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Ban(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bans"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, index=True)
    reason: Mapped[str] = mapped_column(String(255))
    until_at: Mapped[datetime | None]
    permanent: Mapped[bool] = mapped_column(default=False)
