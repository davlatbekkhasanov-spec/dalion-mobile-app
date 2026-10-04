from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PaymentMethodEnum, PaymentStatusEnum
from app.models.premium_payment import PremiumPayment


class PaymentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> PremiumPayment:
        payment = PremiumPayment(**kwargs)
        self.session.add(payment)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def get_by_id(self, payment_id: UUID) -> PremiumPayment | None:
        result = await self.session.execute(
            select(PremiumPayment).where(PremiumPayment.id == payment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_payload(self, payload: str) -> PremiumPayment | None:
        result = await self.session.execute(
            select(PremiumPayment).where(PremiumPayment.payload == payload)
        )
        return result.scalar_one_or_none()

    async def get_by_tx_hash(self, tx_hash: str) -> PremiumPayment | None:
        result = await self.session.execute(
            select(PremiumPayment).where(PremiumPayment.tx_hash == tx_hash)
        )
        return result.scalar_one_or_none()

    async def list_pending_ton(self) -> list[PremiumPayment]:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(PremiumPayment).where(
                PremiumPayment.method == PaymentMethodEnum.ton,
                PremiumPayment.status == PaymentStatusEnum.pending,
                PremiumPayment.expires_at > now,
            )
        )
        return list(result.scalars().all())

    async def update(self, payment: PremiumPayment, **kwargs) -> PremiumPayment:
        for field, value in kwargs.items():
            setattr(payment, field, value)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def expire_stale_ton(self) -> int:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(PremiumPayment).where(
                PremiumPayment.method == PaymentMethodEnum.ton,
                PremiumPayment.status == PaymentStatusEnum.pending,
                PremiumPayment.expires_at <= now,
            )
        )
        payments = list(result.scalars().all())
        for payment in payments:
            payment.status = PaymentStatusEnum.expired
        if payments:
            await self.session.commit()
        return len(payments)
