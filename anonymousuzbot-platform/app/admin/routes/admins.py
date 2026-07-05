from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission
from app.admin.services import AdminUserService, AuditService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.models.enums import AdminRoleEnum

router = APIRouter(prefix="/admin/admins", tags=["admin-admins"])


@router.get("", response_class=HTMLResponse)
async def admins_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.ADMINS_MANAGE)),
):
    service = AdminUserService(session)
    admins = await service.list_admins()
    return templates.TemplateResponse(
        request,
        "admins/list.html",
        {
            "admin": admin,
            "admins": admins,
            "AdminRoleEnum": AdminRoleEnum,
            "title": "Admin Accounts",
        },
    )


@router.post("/create")
async def create_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.ADMINS_MANAGE)),
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
):
    try:
        parsed_role = AdminRoleEnum(role)
    except ValueError:
        return RedirectResponse("/admin/admins", status_code=302)
    service = AdminUserService(session)
    new_admin = await service.create_admin(username.strip(), password, parsed_role)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="create_admin",
        target_type="admin",
        target_id=new_admin.id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/admins", status_code=302)


@router.post("/{admin_id}/toggle")
async def toggle_admin(
    request: Request,
    admin_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.ADMINS_MANAGE)),
):
    if admin_id == admin.id:
        return RedirectResponse("/admin/admins", status_code=302)
    service = AdminUserService(session)
    updated = await service.toggle_active(admin_id)
    if updated:
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="toggle_admin_active",
            target_type="admin",
            target_id=admin_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse("/admin/admins", status_code=302)
