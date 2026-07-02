from fastapi import APIRouter

from app.admin.routes import admins, audit, auth, bans, chats, dashboard, premium, reports, settings, signals, statistics, users

router = APIRouter()
router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(users.router)
router.include_router(chats.router)
router.include_router(reports.router)
router.include_router(signals.router)
router.include_router(bans.router)
router.include_router(premium.router)
router.include_router(statistics.router)
router.include_router(audit.router)
router.include_router(settings.router)
router.include_router(admins.router)
