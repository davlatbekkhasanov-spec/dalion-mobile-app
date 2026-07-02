from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import chat_keyboard
from app.database.session import SessionLocal
from app.repository.user_repository import UserRepository
from app.services.matchmaking import MatchmakingService

router = Router(name="menu")


@router.callback_query(F.data == "menu:find")
async def find_chat(callback: CallbackQuery) -> None:
    await callback.message.edit_text("🔎 Searching... ░▒▓", reply_markup=None)

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer("Please /start first")
            return

        matcher = MatchmakingService(session)
        chat = await matcher.enqueue_or_match(user.id)

    if chat is None:
        await callback.message.answer("Still searching...", reply_markup=chat_keyboard())
        return

    await callback.message.answer(
        "🔔 Match Found\nCyber connection established",
        reply_markup=chat_keyboard(),
    )


@router.callback_query(F.data == "menu:premium")
async def premium_menu(callback: CallbackQuery) -> None:
    await callback.message.edit_text(
        "⭐️ Premium\nPriority match\nExclusive avatars\nMore likes"
    )


@router.callback_query(F.data == "menu:settings")
async def settings_menu(callback: CallbackQuery) -> None:
    await callback.message.edit_text("⚙️ Settings\nUpdate profile and privacy preferences")
