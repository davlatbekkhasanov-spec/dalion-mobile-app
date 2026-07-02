from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from app.bot.keyboards.main import age_keyboard, main_menu_keyboard
from app.bot.states.registration import RegistrationStates
from app.database.session import SessionLocal
from app.models.enums import GenderEnum
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = Router()


@router.callback_query(F.data.startswith("reg:gender:"))
async def choose_gender(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    gender = callback.data.split(":")[-1]
    await state.update_data(gender=gender)
    await state.set_state(RegistrationStates.choosing_age)
    await callback.message.edit_text("Yoshni tanlang", reply_markup=age_keyboard(prefix="reg"))
    await callback.answer()


@router.callback_query(F.data.startswith("reg:age:"))
async def choose_age(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    age = int(callback.data.split(":")[-1])
    data = await state.get_data()
    gender_value = data.get("gender")
    if gender_value not in {"male", "female"}:
        await callback.answer("Avval jinsni tanlang", show_alert=False)
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("Qaytadan /start bosing", show_alert=True)
            return

        service = UserService(session)
        user = await service.complete_registration(user, GenderEnum(gender_value), age)

    await state.clear()
    gender_emoji = "💙" if user.gender == GenderEnum.male else "🩷"
    await callback.message.edit_text(
        f"✅ Tayyor\n"
        f"👤 {user.anonymous_nick}\n"
        f"{gender_emoji} {'Yigit' if user.gender == GenderEnum.male else 'Qiz'}\n"
        f"🎂 {user.age}",
        reply_markup=main_menu_keyboard(),
    )
    await callback.answer()
