from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin
from app.models.enums import BanTypeEnum


class Ban(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "bans"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String(255))
    type: Mapped[BanTypeEnum] = mapped_column(Enum(BanTypeEnum, name="ban_type_enum"), index=True)
    until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="bans")
