from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from app.bot.i18n import DEFAULT_LANG, normalize_lang
from app.database.session import SessionLocal
from app.repositories.user_repository import UserRepository


class UserContextMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        tg_user = data.get("event_from_user")
        if tg_user is None:
            data.setdefault("lang", DEFAULT_LANG)
            return await handler(event, data)

        async with SessionLocal() as session:
            db_user = await UserRepository(session).get_by_telegram_id(tg_user.id)
            data["db_user"] = db_user
            data["lang"] = normalize_lang(db_user.language if db_user else None)
            return await handler(event, data)
