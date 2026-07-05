from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission
from app.admin.services import AdminSettingService, AuditService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@router.get("", response_class=HTMLResponse)
async def settings_page(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SETTINGS_MANAGE)),
):
    service = AdminSettingService(session)
    settings_list = await service.list_settings()
    return templates.TemplateResponse(
        request,
        "settings/index.html",
        {"admin": admin, "settings": settings_list, "title": "Settings"},
    )


@router.post("")
async def update_settings(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SETTINGS_MANAGE)),
    key: str = Form(...),
    value: str = Form(...),
):
    service = AdminSettingService(session)
    await service.update_setting(key.strip(), value)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="update_setting",
        target_type="setting",
        target_id=None,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/settings", status_code=302)
