from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.admin.dependencies import AuthRedirect
from app.admin.routes import router as admin_router
from app.admin.services import AdminAuthService
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.database.session import SessionLocal


ADMIN_STATIC = Path(__file__).resolve().parent.parent / "admin" / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with SessionLocal() as session:
        auth = AdminAuthService(session)
        await auth.bootstrap_owner_if_needed()
    yield


setup_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=settings.admin_session_secret, https_only=False)
app.mount("/admin/static", StaticFiles(directory=str(ADMIN_STATIC)), name="admin-static")
app.include_router(health_router)
app.include_router(admin_router)


@app.exception_handler(AuthRedirect)
async def auth_redirect_handler(request: Request, exc: AuthRedirect):
    return RedirectResponse(exc.url, status_code=302)
