from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import (
    chat_control_keyboard,
    main_menu_keyboard,
    premium_keyboard,
    search_wait_keyboard,
    settings_keyboard,
)
from app.bot.utils.messages import safe_edit_message
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


def _match_text(lang: str, premium: bool = False) -> str:
    key = "premium_match_found" if premium else "match_found"
    return t(key, lang)


def _premium_status_text(user, lang: str) -> str:
    if PremiumService.is_premium(user):
        until = user.premium_until
        date_str = until.strftime("%Y-%m-%d") if until else "—"
        return (
            f"{t('premium_active', lang)}\n"
            f"{t('premium_valid_until', lang, date=date_str)}\n\n"
            f"{t('premium_features', lang)}"
        )
    return f"{t('premium_inactive', lang)}\n\n{t('premium_benefits_title', lang)}\n{t('premium_features', lang)}"


@router.callback_query(F.data == "menu:find")
async def find_chat(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        user = await PremiumService(session).refresh_premium_state(user)
        service = MatchmakingService(session, bot=callback.bot)
        try:
            chat = await service.start_search(user, lang)
        except ValueError as exc:
            await callback.message.answer(str(exc))
            return

    if chat is None:
        await safe_edit_message(
            callback.message,
            t("searching", lang),
            reply_markup=search_wait_keyboard(lang),
        )
        return

    await safe_edit_message(
        callback.message,
        _match_text(lang, PremiumService.is_premium(user)),
        reply_markup=chat_control_keyboard(lang),
    )


@router.callback_query(F.data == "menu:cancel_search")
async def cancel_search(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        service = MatchmakingService(session, bot=callback.bot)
        await service.cancel_search(user)

    await safe_edit_message(callback.message, t("main_menu", lang), reply_markup=main_menu_keyboard(lang))


@router.callback_query(F.data == "menu:premium")
async def premium(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        premium_service = PremiumService(session)
        referral_service = ReferralService(session)
        user = await premium_service.refresh_premium_state(user)
        status = _premium_status_text(user, lang)
        stats = await referral_service.get_stats(user)
        bot_username = await _get_bot_username(callback.bot)
        link = referral_service.build_referral_link(user, bot_username)

    text = (
        f"{status}\n\n"
        "━━━━━━━━━━━━━━\n"
        f"{t('referral_title', lang)}\n\n"
        f"{t('referral_progress', lang, progress=stats['progress'], required=stats['required'])}\n"
        f"{t('referral_total', lang, total=stats['total'])}\n\n"
        f"{t('referral_link', lang, link=link)}"
    )
    await safe_edit_message(callback.message, text, reply_markup=premium_keyboard(lang))


@router.callback_query(F.data == "menu:settings")
async def settings(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await safe_edit_message(
        callback.message,
        t("settings_title", lang),
        reply_markup=settings_keyboard(lang),
    )
