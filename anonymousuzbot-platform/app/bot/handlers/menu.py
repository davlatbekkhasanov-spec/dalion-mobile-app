from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import main_menu_keyboard, settings_keyboard

router = Router()


@router.callback_query(F.data == "menu:find")
async def find_chat(callback: CallbackQuery) -> None:
    if callback.message is None:
        return
    await callback.message.edit_text("🔎 Chat qidirilmoqda...", reply_markup=main_menu_keyboard())
    await callback.answer()


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
