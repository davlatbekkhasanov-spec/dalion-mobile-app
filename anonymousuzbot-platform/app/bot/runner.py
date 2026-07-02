from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties

from app.bot.handlers.start import router as start_router
from app.core.config import settings


async def run_bot() -> None:
    # TODO: switch to webhook mode behind reverse proxy in production.
    bot = Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=settings.bot_parse_mode))
    dp = Dispatcher()
    dp.include_router(start_router)
    await dp.start_polling(bot)
