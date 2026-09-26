from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission
from app.admin.services import AuditService, ModerationService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.repositories.ban_repository import BanRepository

router = APIRouter(prefix="/admin/bans", tags=["admin-bans"])


@router.get("", response_class=HTMLResponse)
async def bans_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.BANS_VIEW)),
    tab: str = "active",
):
    repo = BanRepository(session)
    active = await repo.list_active()
    expired = await repo.list_expired()
    return templates.TemplateResponse(
        request,
        "bans/list.html",
        {
            "admin": admin,
            "active_bans": active,
            "expired_bans": expired,
            "tab": tab,
            "title": "Bans",
        },
    )


@router.post("/unban/{user_id}")
async def unban_user(
    request: Request,
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.BANS_MANAGE)),
):
    mod = ModerationService(session)
    await mod.unban_user(user_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="unban_user",
        target_type="user",
        target_id=user_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/bans", status_code=302)
