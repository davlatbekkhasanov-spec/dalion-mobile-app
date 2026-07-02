from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import Update
from aiogram.utils.callback_answer import CallbackAnswerMiddleware

from app.bot.handlers import chat, menu, registration, settings, start
from app.bot.middlewares.user_context import UserContextMiddleware
from app.core.config import settings as app_settings

_bot: Bot | None = None
_dp: Dispatcher | None = None


def get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(
            token=app_settings.bot_token,
            default=DefaultBotProperties(parse_mode=app_settings.bot_parse_mode),
        )
    return _bot


def get_dispatcher() -> Dispatcher:
    global _dp
    if _dp is None:
        storage = RedisStorage.from_url(app_settings.redis_url)
        _dp = Dispatcher(storage=storage)
        _dp.update.middleware(UserContextMiddleware())
        _dp.callback_query.middleware(CallbackAnswerMiddleware(pre=True))
        _dp.include_router(start.router)
        _dp.include_router(registration.router)
        _dp.include_router(menu.router)
        _dp.include_router(settings.router)
        _dp.include_router(chat.router)
    return _dp


async def process_update(update: Update) -> None:
    await get_dispatcher().feed_update(get_bot(), update)


async def resolve_bot_username() -> str:
    if app_settings.bot_username:
        return app_settings.bot_username.lstrip("@")
    me = await get_bot().get_me()
    return me.username or "your_bot"


async def run_polling() -> None:
    await get_dispatcher().start_polling(get_bot())


async def setup_webhook() -> None:
    bot = get_bot()
    await bot.set_webhook(
        url=app_settings.effective_webhook_path,
        secret_token=app_settings.webhook_secret,
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query", "my_chat_member"],
    )


async def shutdown_webhook() -> None:
    await get_bot().delete_webhook(drop_pending_updates=False)
