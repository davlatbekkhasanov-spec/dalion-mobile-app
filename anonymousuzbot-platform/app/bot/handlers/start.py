from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

router = Router()


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    # TODO: replace with registration onboarding flow.
    await message.answer("Anonymous Chat platform is initializing...")
