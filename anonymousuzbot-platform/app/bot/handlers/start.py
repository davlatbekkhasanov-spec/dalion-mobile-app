from aiogram import Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import language_keyboard, main_menu_keyboard
from app.bot.states.registration import RegistrationStates
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = Router()


def _parse_referrer_id(args: str | None) -> str | None:
    if not args:
        return None
    if args.startswith("ref_"):
        return args.removeprefix("ref_")
    return None


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext, command: CommandObject) -> None:
    if message.from_user is None:
        return

    referrer_id = _parse_referrer_id(command.args)

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(message.from_user.id)

        if user is not None and user.is_registered:
            await repo.update_last_seen(user.id)
            await state.clear()
            lang = normalize_lang(user.language)
            await message.answer(t("main_menu", lang), reply_markup=main_menu_keyboard(lang))
            return

        service = UserService(session)
        await service.get_or_create_unregistered(message.from_user.id)

    if referrer_id:
        await state.update_data(referrer_id=referrer_id)
    await state.set_state(RegistrationStates.choosing_language)
    await message.answer(
        f"{t('choose_language', 'uz')}\n{t('choose_language', 'ru')}",
        reply_markup=language_keyboard(prefix="reg"),
    )
