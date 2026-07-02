from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import age_keyboard, gender_keyboard, main_menu_keyboard, settings_keyboard
from app.bot.states.registration import SettingsStates
from app.database.session import SessionLocal
from app.models.enums import GenderEnum
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = Router()


def _gender_label(gender: GenderEnum) -> str:
    return "Yigit" if gender == GenderEnum.male else "Qiz"


@router.callback_query(F.data == "settings:profile")
async def my_profile(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)

    if user is None:
        await callback.answer("/start bosing", show_alert=True)
        return

    emoji = "💙" if user.gender == GenderEnum.male else "🩷"
    await callback.message.edit_text(
        f"👤 {user.anonymous_nick}\n"
        f"{emoji} {_gender_label(user.gender)}\n"
        f"🎂 {user.age}",
        reply_markup=settings_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "settings:gender")
async def change_gender(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.message is None:
        return
    await state.set_state(SettingsStates.changing_gender)
    await callback.message.edit_text("Jinsni tanlang", reply_markup=gender_keyboard(prefix="set"))
    await callback.answer()


@router.callback_query(F.data == "settings:age")
async def change_age(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.message is None:
        return
    await state.set_state(SettingsStates.changing_age)
    await callback.message.edit_text("Yoshni tanlang", reply_markup=age_keyboard(prefix="set"))
    await callback.answer()


@router.callback_query(F.data.startswith("set:gender:"))
async def set_gender(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    gender = GenderEnum(callback.data.split(":")[-1])
    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return
        await UserService(session).update_gender(user, gender)

    await state.clear()
    await callback.message.edit_text("✅ Jins yangilandi", reply_markup=settings_keyboard())
    await callback.answer()


@router.callback_query(F.data.startswith("set:age:"))
async def set_age(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    age = int(callback.data.split(":")[-1])
    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return
        await UserService(session).update_age(user, age)

    await state.clear()
    await callback.message.edit_text("✅ Yosh yangilandi", reply_markup=settings_keyboard())
    await callback.answer()


@router.callback_query(F.data == "settings:blocked")
async def blocked_users(callback: CallbackQuery) -> None:
    if callback.message is None:
        return
    await callback.message.edit_text("🚫 Bloklanganlar: 0", reply_markup=settings_keyboard())
    await callback.answer()


@router.callback_query(F.data == "settings:back")
async def back_to_main(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.message is None:
        return
    await state.clear()
    await callback.message.edit_text("Asosiy menyu", reply_markup=main_menu_keyboard())
    await callback.answer()
