from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import (
    chat_control_keyboard,
    main_menu_keyboard,
    search_wait_keyboard,
    settings_keyboard,
)
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.matchmaking_service import MatchmakingService

router = Router()


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

    # Matched user gets immediate UI update; peer is also notified via service.
    await callback.message.edit_text(
        "🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi...",
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
    if callback.message is None:
        return
    await callback.message.edit_text("⭐️ Premium", reply_markup=main_menu_keyboard())
    await callback.answer()


@router.callback_query(F.data == "menu:settings")
async def settings(callback: CallbackQuery) -> None:
    if callback.message is None:
        return
    await callback.message.edit_text("⚙️ Sozlamalar", reply_markup=settings_keyboard())
    await callback.answer()
