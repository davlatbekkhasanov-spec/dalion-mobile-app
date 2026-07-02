from contextlib import asynccontextmanager
from pathlib import Path
import logging

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.admin.dependencies import AuthRedirect
from app.admin.routes import router as admin_router
from app.admin.services import AdminAuthService
from app.api.routes.health import router as health_router
from app.api.routes.webhook import router as webhook_router
from app.bot.setup import resolve_bot_username, setup_webhook, shutdown_webhook
from app.core.config import settings
from app.core.logging import setup_logging
from app.database.session import SessionLocal
from app.services.moderation_config_service import ModerationConfigService


ADMIN_STATIC = Path(__file__).resolve().parent.parent / "admin" / "static"
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with SessionLocal() as session:
            auth = AdminAuthService(session)
            await auth.bootstrap_owner_if_needed()
            await ModerationConfigService(session).ensure_defaults()
            await _ensure_platform_settings(session)
    except Exception:
        logger.exception("Startup bootstrap failed; continuing without admin bootstrap")

    app.state.bot_username = settings.bot_username or "your_bot"
    if settings.use_webhook:
        try:
            await setup_webhook()
            app.state.bot_username = await resolve_bot_username()
        except Exception:
            logger.exception("Webhook setup failed; bot updates may not work until restart")
    else:
        try:
            app.state.bot_username = settings.bot_username or (await resolve_bot_username())
        except Exception:
            logger.exception("Failed to resolve bot username")

    yield

    if settings.use_webhook:
        try:
            await shutdown_webhook()
        except Exception:
            logger.exception("Webhook shutdown failed")


async def _ensure_platform_settings(session) -> None:
    from app.repositories.setting_repository import SettingRepository

    defaults = {
        "premium.likes_per_day_free": "5",
        "premium.likes_per_day_premium": "30",
        "referral.required_invites": "3",
        "referral.reward_days": "7",
    }
    repo = SettingRepository(session)
    for key, value in defaults.items():
        if await repo.get(key) is None:
            await repo.upsert(key, value)


setup_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=settings.admin_session_secret, https_only=False)
app.mount("/admin/static", StaticFiles(directory=str(ADMIN_STATIC)), name="admin-static")
app.include_router(health_router)
app.include_router(webhook_router)
app.include_router(admin_router)


@app.exception_handler(AuthRedirect)
async def auth_redirect_handler(request: Request, exc: AuthRedirect):
    return RedirectResponse(exc.url, status_code=302)
