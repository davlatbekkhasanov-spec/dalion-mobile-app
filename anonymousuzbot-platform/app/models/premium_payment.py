from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentMethodEnum, PaymentStatusEnum


class PremiumPayment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "premium_payments"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    method: Mapped[PaymentMethodEnum] = mapped_column(
        Enum(PaymentMethodEnum, name="payment_method_enum"), nullable=False
    )
    status: Mapped[PaymentStatusEnum] = mapped_column(
        Enum(PaymentStatusEnum, name="payment_status_enum"),
        default=PaymentStatusEnum.pending,
        nullable=False,
    )
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    payload: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    telegram_charge_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="premium_payments")
