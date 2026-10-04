from aiogram import F, Router
from aiogram.types import CallbackQuery, LabeledPrice, Message, PreCheckoutQuery

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import premium_keyboard
from app.bot.utils.messages import safe_edit_message
from app.core.config import settings
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.payment_service import PLAN_DAYS, PaymentService
from app.services.premium_service import PremiumService

router = Router()


def _plan_label(days: int, lang: str) -> str:
    if lang == "ru":
        return f"Premium {days} дн."
    return f"Premium {days} kun"


@router.callback_query(F.data.startswith("pay:stars:"))
async def pay_with_stars(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    try:
        days = int(callback.data.split(":")[-1])
    except (ValueError, IndexError):
        return
    if days not in PLAN_DAYS:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        payment_service = PaymentService(session)
        try:
            payment = await payment_service.create_stars_payment(user.id, days)
        except ValueError as exc:
            await callback.message.answer(str(exc))
            return

    await callback.message.answer_invoice(
        title=_plan_label(days, lang),
        description=t("payment_stars_description", lang, days=days),
        payload=payment.payload,
        currency="XTR",
        prices=[LabeledPrice(label=_plan_label(days, lang), amount=payment.amount)],
        provider_token="",
    )


@router.callback_query(F.data.startswith("pay:ton:"))
async def pay_with_ton(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    if not settings.ton_wallet_address:
        await callback.message.answer(t("payment_ton_unavailable", lang))
        return

    try:
        days = int(callback.data.split(":")[-1])
    except (ValueError, IndexError):
        return
    if days not in PLAN_DAYS:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        payment_service = PaymentService(session)
        try:
            payment = await payment_service.create_ton_payment(
                user.id,
                days,
                settings.ton_payment_ttl_minutes,
            )
        except ValueError as exc:
            await callback.message.answer(str(exc))
            return

        ton_amount = payment_service.format_ton_amount(payment.amount)
        expires = payment.expires_at.strftime("%H:%M") if payment.expires_at else "—"

    text = t(
        "payment_ton_instructions",
        lang,
        days=days,
        amount=ton_amount,
        wallet=settings.ton_wallet_address,
        comment=payment.payload,
        expires=expires,
    )
    await safe_edit_message(callback.message, text, reply_markup=premium_keyboard(lang, show_buy=False))


@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery) -> None:
    async with SessionLocal() as session:
        payment_service = PaymentService(session)
        payment = await payment_service.get_pending_stars_payment(query.invoice_payload)

    if payment is None:
        await query.answer(ok=False, error_message="Payment not found or expired")
        return
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(message: Message, lang: str = "uz") -> None:
    if message.from_user is None or message.successful_payment is None:
        return

    payment_info = message.successful_payment
    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(message.from_user.id)
        if user is None:
            return

        lang = normalize_lang(user.language)
        payment_service = PaymentService(session)
        payment = await payment_service.get_pending_stars_payment(payment_info.invoice_payload)
        if payment is None or payment.user_id != user.id:
            await message.answer(t("payment_failed", lang))
            return

        completed = await payment_service.complete_stars_payment(
            payment,
            payment_info.telegram_payment_charge_id,
        )

    await message.answer(t("payment_success", lang, days=completed.days))
