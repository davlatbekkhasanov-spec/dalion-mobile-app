from aiogram import BaseMiddleware
from aiogram.types import TelegramObject


class SimpleRateLimitMiddleware(BaseMiddleware):
    async def __call__(self, handler, event: TelegramObject, data):
        return await handler(event, data)
