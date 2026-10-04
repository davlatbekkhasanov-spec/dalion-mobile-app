from __future__ import annotations

import asyncio
import logging

import httpx

from app.bot.setup import get_bot
from app.bot.i18n import normalize_lang, t
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.enums import PaymentStatusEnum
from app.repositories.payment_repository import PaymentRepository
from app.services.payment_service import PaymentService

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 30
TONCENTER_URL = "https://toncenter.com/api/v2/getTransactions"


class TonPaymentPoller:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._poll_once()
            except Exception:
                logger.exception("TON payment poll failed")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=POLL_INTERVAL_SECONDS)
                break
            except asyncio.TimeoutError:
                continue

    async def _poll_once(self) -> None:
        if not settings.ton_wallet_address:
            return

        async with SessionLocal() as session:
            payment_repo = PaymentRepository(session)
            expired = await payment_repo.expire_stale_ton()
            if expired:
                logger.info("Expired %s stale TON payments", expired)

            pending = await payment_repo.list_pending_ton()
            if not pending:
                return

            transactions = await self._fetch_transactions()
            if not transactions:
                return

            payment_service = PaymentService(session)
            pending_by_payload = {p.payload: p for p in pending}
            pending_by_amount = {}
            for payment in pending:
                pending_by_amount.setdefault(payment.amount, []).append(payment)

            for tx in transactions:
                comment = self._extract_comment(tx)
                value = self._extract_value(tx)
                tx_hash = self._extract_tx_hash(tx)
                if not tx_hash or value is None:
                    continue

                payment = None
                if comment and comment in pending_by_payload:
                    candidate = pending_by_payload[comment]
                    if candidate.amount <= value:
                        payment = candidate
                elif value in pending_by_amount:
                    for candidate in pending_by_amount[value]:
                        if candidate.status == PaymentStatusEnum.pending:
                            payment = candidate
                            break

                if payment is None:
                    continue

                try:
                    completed = await payment_service.complete_ton_payment(payment, tx_hash)
                except ValueError:
                    continue

                await self._notify_user(completed.user_id, completed.days, session)

    async def _fetch_transactions(self) -> list[dict]:
        params = {
            "address": settings.ton_wallet_address,
            "limit": 30,
            "archival": "true",
        }
        if settings.toncenter_api_key:
            params["api_key"] = settings.toncenter_api_key

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(TONCENTER_URL, params=params)
                response.raise_for_status()
                data = response.json()
        except Exception:
            logger.exception("Failed to fetch TON transactions")
            return []

        if not data.get("ok"):
            logger.warning("TON Center error: %s", data)
            return []
        return data.get("result") or []

    @staticmethod
    def _extract_comment(tx: dict) -> str | None:
        in_msg = tx.get("in_msg") or {}
        message = in_msg.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()

        decoded = in_msg.get("decoded_body") or {}
        if isinstance(decoded, dict):
            text = decoded.get("text") or decoded.get("comment")
            if isinstance(text, str) and text.strip():
                return text.strip()
        return None

    @staticmethod
    def _extract_value(tx: dict) -> int | None:
        in_msg = tx.get("in_msg") or {}
        value = in_msg.get("value")
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _extract_tx_hash(tx: dict) -> str | None:
        tx_id = tx.get("transaction_id") or {}
        lt = tx_id.get("lt")
        hash_value = tx_id.get("hash")
        if lt and hash_value:
            return f"{lt}:{hash_value}"
        return tx.get("hash") or None

    async def _notify_user(self, user_id, days: int, session) -> None:
        from app.repositories.user_repository import UserRepository

        user = await UserRepository(session).get_by_id(user_id)
        if user is None:
            return

        lang = normalize_lang(user.language)
        bot = get_bot()
        try:
            await bot.send_message(
                user.telegram_id,
                t("payment_success", lang, days=days),
            )
        except Exception:
            logger.exception("Failed to notify user %s about TON payment", user.telegram_id)


ton_payment_poller = TonPaymentPoller()
