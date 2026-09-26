from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class Referral(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "referrals"

    inviter_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    invited_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, index=True)
    reward_given: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    inviter = relationship("User", foreign_keys=[inviter_id], back_populates="referrals_invited")
    invited = relationship("User", foreign_keys=[invited_id], back_populates="referral_joined")
