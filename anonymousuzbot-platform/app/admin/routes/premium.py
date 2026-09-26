from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission
from app.admin.services import AuditService, ModerationService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin/premium", tags=["admin-premium"])


@router.get("", response_class=HTMLResponse)
async def premium_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.PREMIUM_MANAGE)),
):
    mod = ModerationService(session)
    users = await mod.list_premium_users()
    return templates.TemplateResponse(
        request,
        "premium/list.html",
        {"admin": admin, "users": users, "title": "Premium"},
    )


@router.post("/give")
async def give_premium(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.PREMIUM_MANAGE)),
    user_id: str = Form(...),
    days: int = Form(30),
):
    try:
        uid = UUID(user_id.strip())
    except ValueError:
        return RedirectResponse("/admin/premium", status_code=302)
    mod = ModerationService(session)
    await mod.give_premium(uid, days=days)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="give_premium",
        target_type="user",
        target_id=uid,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/premium", status_code=302)


@router.post("/remove")
async def remove_premium(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.PREMIUM_MANAGE)),
    user_id: str = Form(...),
):
    try:
        uid = UUID(user_id.strip())
    except ValueError:
        return RedirectResponse("/admin/premium", status_code=302)
    mod = ModerationService(session)
    await mod.remove_premium(uid)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="remove_premium",
        target_type="user",
        target_id=uid,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/premium", status_code=302)
