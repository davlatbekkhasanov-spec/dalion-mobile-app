from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, require_permission
from app.admin.permissions import Permission
from app.admin.services import AdminStatsService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin", tags=["admin-statistics"])


@router.get("/statistics", response_class=HTMLResponse)
async def statistics_page(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.STATS_VIEW)),
):
    stats_service = AdminStatsService(session)
    stats = await stats_service.get_dashboard_stats()
    return templates.TemplateResponse(
        request,
        "statistics.html",
        {"admin": admin, "stats": stats, "title": "Statistics"},
    )
