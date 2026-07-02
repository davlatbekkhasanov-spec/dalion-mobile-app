from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission, has_permission
from app.admin.services import AdminUserQueryService, AuditService, ModerationService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("", response_class=HTMLResponse)
async def users_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_VIEW)),
    uuid: str | None = None,
    telegram_id: str | None = None,
):
    service = AdminUserQueryService(session)
    tg_id = None
    if telegram_id and has_permission(admin.role, Permission.USERS_TELEGRAM_SEARCH):
        try:
            tg_id = int(telegram_id.strip())
        except ValueError:
            tg_id = None
    users = await service.search_users(uuid_query=uuid, telegram_id=tg_id)
    return templates.TemplateResponse(
        request,
        "users/list.html",
        {
            "admin": admin,
            "users": users,
            "uuid": uuid or "",
            "telegram_id": telegram_id or "",
            "can_telegram_search": has_permission(admin.role, Permission.USERS_TELEGRAM_SEARCH),
            "title": "Users",
        },
    )


@router.get("/{user_id}", response_class=HTMLResponse)
async def user_detail(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_VIEW)),
):
    service = AdminUserQueryService(session)
    detail = await service.get_user_detail(user_id)
    if detail is None:
        return RedirectResponse("/admin/users", status_code=302)
    return templates.TemplateResponse(
        request,
        "users/detail.html",
        {
            "admin": admin,
            "detail": detail,
            "can_manage": has_permission(admin.role, Permission.USERS_MANAGE),
            "can_telegram_search": has_permission(admin.role, Permission.USERS_TELEGRAM_SEARCH),
            "title": f"User {user_id}",
        },
    )


@router.post("/{user_id}/warn")
async def warn_user(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_MANAGE)),
    reason: str = Form("Policy violation"),
):
    mod = ModerationService(session)
    user = await mod.warn_user(user_id)
    if user:
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="warn_user",
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/users/{user_id}", status_code=302)


@router.post("/{user_id}/mute")
async def mute_user(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_MANAGE)),
):
    mod = ModerationService(session)
    await mod.mute_user(user_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="mute_user",
        target_type="user",
        target_id=user_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/users/{user_id}", status_code=302)


@router.post("/{user_id}/temp-ban")
async def temp_ban_user(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_MANAGE)),
    reason: str = Form("Policy violation"),
    days: int = Form(7),
):
    mod = ModerationService(session)
    await mod.temp_ban_user(user_id, reason, days=days)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="temp_ban_user",
        target_type="user",
        target_id=user_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/users/{user_id}", status_code=302)


@router.post("/{user_id}/perm-ban")
async def perm_ban_user(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.USERS_MANAGE)),
    reason: str = Form("Policy violation"),
):
    mod = ModerationService(session)
    await mod.permanent_ban_user(user_id, reason)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="perm_ban_user",
        target_type="user",
        target_id=user_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/users/{user_id}", status_code=302)
