from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, require_admin
from app.admin.permissions import Permission, has_permission
from app.admin.services import AdminStatsService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin", tags=["admin-dashboard"])


@router.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_admin),
):
    if not has_permission(admin.role, Permission.STATS_VIEW):
        if has_permission(admin.role, Permission.REPORTS_VIEW):
            return RedirectResponse("/admin/reports", status_code=302)
        raise HTTPException(status_code=403)
    stats_service = AdminStatsService(session)
    stats = await stats_service.get_dashboard_stats()
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {"admin": admin, "stats": stats, "title": "Dashboard"},
    )
