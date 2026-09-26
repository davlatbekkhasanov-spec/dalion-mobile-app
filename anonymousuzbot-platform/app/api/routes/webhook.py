from fastapi import APIRouter, Header, HTTPException, Request, status
from aiogram.types import Update
import logging

from app.bot.setup import process_update
from app.core.config import settings

router = APIRouter(tags=["webhook"])
logger = logging.getLogger(__name__)


@router.post("/webhook/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    if settings.webhook_secret and x_telegram_bot_api_secret_token != settings.webhook_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")

    payload = await request.json()
    update = Update.model_validate(payload)
    try:
        await process_update(update)
    except Exception:
        logger.exception("Telegram update processing failed")
    return {"ok": True}
