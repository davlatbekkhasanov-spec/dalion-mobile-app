from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import GenderEnum


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    gender: Mapped[GenderEnum] = mapped_column(Enum(GenderEnum, name="gender_enum"), index=True)
    age: Mapped[int] = mapped_column(Integer)
    anonymous_nick: Mapped[str] = mapped_column(String(64), index=True)

    is_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    premium_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    male_chats = relationship(
        "ChatSession",
        foreign_keys="ChatSession.male_user_id",
        back_populates="male_user",
    )
    female_chats = relationship(
        "ChatSession",
        foreign_keys="ChatSession.female_user_id",
        back_populates="female_user",
    )
    sent_messages = relationship("Message", back_populates="sender")
    reports_made = relationship("Report", foreign_keys="Report.reporter_id", back_populates="reporter")
    reports_received = relationship(
        "Report",
        foreign_keys="Report.reported_user_id",
        back_populates="reported_user",
    )
    referrals_invited = relationship(
        "Referral",
        foreign_keys="Referral.inviter_id",
        back_populates="inviter",
    )
    referral_joined = relationship(
        "Referral",
        foreign_keys="Referral.invited_id",
        back_populates="invited",
        uselist=False,
    )
    bans = relationship("Ban", back_populates="user")
