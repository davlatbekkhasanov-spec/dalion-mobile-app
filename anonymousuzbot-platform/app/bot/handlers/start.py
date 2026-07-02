from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app.bot.keyboards.main import age_keyboard, gender_keyboard, main_menu_keyboard
from app.bot.states.registration import RegistrationState
from app.database.session import SessionLocal
from app.models.enums import Gender
from app.repository.user_repository import UserRepository

router = Router(name="start")


@router.message(F.text == "/start")
async def start_handler(message: Message, state: FSMContext) -> None:
    await state.set_state(RegistrationState.gender)
    await message.answer("Choose gender", reply_markup=gender_keyboard())


@router.callback_query(F.data.startswith("reg:gender:"))
async def reg_gender(callback: CallbackQuery, state: FSMContext) -> None:
    gender = callback.data.split(":")[-1]
    await state.update_data(gender=gender)
    await state.set_state(RegistrationState.age)
    await callback.message.edit_text("Choose age", reply_markup=age_keyboard())


@router.callback_query(F.data.startswith("reg:age:"))
async def reg_age(callback: CallbackQuery, state: FSMContext) -> None:
    age = int(callback.data.split(":")[-1])
    data = await state.get_data()

    async with SessionLocal() as session:
        repo = UserRepository(session)
        existing = await repo.get_by_telegram_id(callback.from_user.id)
        if existing is None:
            await repo.create_user(
                telegram_id=callback.from_user.id,
                gender=Gender(data["gender"]),
                age=age,
            )

    await state.clear()
    await callback.message.edit_text("Main Menu", reply_markup=main_menu_keyboard())
