from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties

from app.bot.handlers import menu, registration, settings, start
from app.core.config import settings as app_settings


async def run_bot() -> None:
    # TODO: switch to webhook mode behind reverse proxy in production.
    bot = Bot(token=app_settings.bot_token, default=DefaultBotProperties(parse_mode=app_settings.bot_parse_mode))
    dp = Dispatcher()
    dp.include_router(start.router)
    dp.include_router(registration.router)
    dp.include_router(menu.router)
    dp.include_router(settings.router)
    await dp.start_polling(bot)
