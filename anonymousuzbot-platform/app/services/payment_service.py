from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PaymentMethodEnum, PaymentStatusEnum
from app.models.premium_payment import PremiumPayment
from app.repositories.payment_repository import PaymentRepository
from app.repositories.setting_repository import SettingRepository
from app.repositories.user_repository import UserRepository
from app.services.premium_service import PremiumService

logger = logging.getLogger(__name__)

PLAN_DAYS = (7, 30)
SETTING_KEYS = {
    "stars_7": "payment.stars.price_7",
    "stars_30": "payment.stars.price_30",
    "ton_7": "payment.ton.price_7",
    "ton_30": "payment.ton.price_30",
}
DEFAULT_PRICES = {
    "payment.stars.price_7": "50",
    "payment.stars.price_30": "150",
    "payment.ton.price_7": "500000000",
    "payment.ton.price_30": "1500000000",
}


class PaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.payment_repo = PaymentRepository(session)
        self.setting_repo = SettingRepository(session)
        self.premium_service = PremiumService(session)

    async def get_prices(self) -> dict[str, int]:
        prices: dict[str, int] = {}
        for key, setting_key in SETTING_KEYS.items():
            raw = await self.setting_repo.get(setting_key)
            if raw is None:
                raw = DEFAULT_PRICES[setting_key]
            prices[key] = int(raw)
        return prices

    async def create_stars_payment(self, user_id: UUID, days: int) -> PremiumPayment:
        prices = await self.get_prices()
        amount_key = f"stars_{days}"
        if amount_key not in prices:
            raise ValueError(f"Unsupported plan: {days} days")

        payment = await self.payment_repo.create(
            user_id=user_id,
            method=PaymentMethodEnum.stars,
            status=PaymentStatusEnum.pending,
            days=days,
            amount=prices[amount_key],
            currency="XTR",
            payload=str(uuid4()),
        )
        return payment

    async def create_ton_payment(
        self,
        user_id: UUID,
        days: int,
        ttl_minutes: int,
    ) -> PremiumPayment:
        from app.core.config import settings

        prices = await self.get_prices()
        amount_key = f"ton_{days}"
        if amount_key not in prices:
            raise ValueError(f"Unsupported plan: {days} days")

        payload = f"prem_{uuid4().hex[:12]}"
        payment = await self.payment_repo.create(
            user_id=user_id,
            method=PaymentMethodEnum.ton,
            status=PaymentStatusEnum.pending,
            days=days,
            amount=prices[amount_key],
            currency="TON",
            payload=payload,
            expires_at=datetime.now(UTC) + timedelta(minutes=ttl_minutes or settings.ton_payment_ttl_minutes),
        )
        return payment

    async def get_pending_stars_payment(self, payload: str) -> PremiumPayment | None:
        payment = await self.payment_repo.get_by_payload(payload)
        if payment is None:
            return None
        if payment.method != PaymentMethodEnum.stars or payment.status != PaymentStatusEnum.pending:
            return None
        return payment

    async def complete_stars_payment(
        self,
        payment: PremiumPayment,
        telegram_charge_id: str,
    ) -> PremiumPayment:
        if payment.status != PaymentStatusEnum.pending:
            return payment

        updated = await self.payment_repo.update(
            payment,
            status=PaymentStatusEnum.completed,
            telegram_charge_id=telegram_charge_id,
        )
        await self.premium_service.grant_days(updated.user_id, updated.days)
        return updated

    async def complete_ton_payment(self, payment: PremiumPayment, tx_hash: str) -> PremiumPayment:
        if payment.status != PaymentStatusEnum.pending:
            return payment

        existing = await self.payment_repo.get_by_tx_hash(tx_hash)
        if existing is not None and existing.id != payment.id:
            raise ValueError("Transaction already used")

        updated = await self.payment_repo.update(
            payment,
            status=PaymentStatusEnum.completed,
            tx_hash=tx_hash,
        )
        await self.premium_service.grant_days(updated.user_id, updated.days)
        return updated

    @staticmethod
    def format_ton_amount(nano_ton: int) -> str:
        whole = nano_ton // 1_000_000_000
        fraction = nano_ton % 1_000_000_000
        if fraction == 0:
            return str(whole)
        trimmed = f"{fraction:09d}".rstrip("0")
        return f"{whole}.{trimmed}"

    async def get_user_telegram_id(self, user_id: UUID) -> int | None:
        user = await UserRepository(self.session).get_by_id(user_id)
        return user.telegram_id if user else None
