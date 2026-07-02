from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.bot.keyboards.main import gender_keyboard, main_menu_keyboard
from app.bot.states.registration import RegistrationStates
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = Router()


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext) -> None:
    if message.from_user is None:
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(message.from_user.id)

        if user is not None and user.is_registered:
            await repo.update_last_seen(user.id)
            await state.clear()
            await message.answer("Asosiy menyu", reply_markup=main_menu_keyboard())
            return

        service = UserService(session)
        await service.get_or_create_unregistered(message.from_user.id)

    await state.set_state(RegistrationStates.choosing_gender)
    await message.answer("Jinsni tanlang", reply_markup=gender_keyboard(prefix="reg"))
