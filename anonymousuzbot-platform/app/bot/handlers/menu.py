from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import (
    chat_control_keyboard,
    main_menu_keyboard,
    premium_keyboard,
    search_wait_keyboard,
    settings_keyboard,
)
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.matchmaking_service import MatchmakingService
from app.services.premium_service import PremiumService
from app.services.referral_service import ReferralService

router = Router()


async def _get_bot_username(bot) -> str:
    from app.core.config import settings

    if settings.bot_username:
        return settings.bot_username.lstrip("@")
    me = await bot.get_me()
    return me.username or "your_bot"


def _match_text(premium: bool = False) -> str:
    if premium:
        return (
            "✨💎 PREMIUM MATCH ✨\n\n"
            "🔔 PING!\n\n"
            "🎭 Match topildi\n\n"
            "💙 Yigit  ⚡️  🩷 Qiz\n\n"
            "Suhbat boshlandi..."
        )
    return "🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi..."


@router.callback_query(F.data == "menu:find")
async def find_chat(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        user = await PremiumService(session).refresh_premium_state(user)
        service = MatchmakingService(session, bot=callback.bot)
        try:
            chat = await service.start_search(user)
        except ValueError as exc:
            await callback.answer(str(exc), show_alert=True)
            return

    if chat is None:
        await callback.message.edit_text(
            "⚡️ Mos suhbatdosh qidirilmoqda...",
            reply_markup=search_wait_keyboard(),
        )
        await callback.answer()
        return

    await callback.message.edit_text(
        _match_text(PremiumService.is_premium(user)),
        reply_markup=chat_control_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "menu:cancel_search")
async def cancel_search(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        service = MatchmakingService(session, bot=callback.bot)
        await service.cancel_search(user)

    await callback.message.edit_text("Asosiy menyu", reply_markup=main_menu_keyboard())
    await callback.answer("Qidiruv bekor qilindi")


@router.callback_query(F.data == "menu:premium")
async def premium(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        premium_service = PremiumService(session)
        referral_service = ReferralService(session)
        user = await premium_service.refresh_premium_state(user)
        status = await premium_service.get_status_text(user)
        stats = await referral_service.get_stats(user)
        bot_username = await _get_bot_username(callback.bot)
        link = referral_service.build_referral_link(user, bot_username)

    text = (
        f"{status}\n\n"
        "━━━━━━━━━━━━━━\n"
        "🎁 3 ta do‘st taklif qiling\n"
        "💎 7 kun Premium oling\n\n"
        f"📊 Jarayon: {stats['progress']}/{stats['required']}\n"
        f"👥 Jami takliflar: {stats['total']}\n\n"
        f"🔗 Sizning havolangiz:\n{link}"
    )
    await callback.message.edit_text(text, reply_markup=premium_keyboard())
    await callback.answer()


@router.callback_query(F.data == "menu:settings")
async def settings(callback: CallbackQuery) -> None:
    if callback.message is None:
        return
    await callback.message.edit_text("⚙️ Sozlamalar", reply_markup=settings_keyboard())
    await callback.answer()
