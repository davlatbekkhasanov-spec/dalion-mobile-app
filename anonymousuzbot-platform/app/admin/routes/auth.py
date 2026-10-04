from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import (
    SESSION_ADMIN_ID,
    SESSION_ADMIN_ROLE,
    SESSION_ADMIN_USERNAME,
    AdminContext,
    AuthRedirect,
    get_client_ip,
    get_current_admin_optional,
    require_admin,
)
from app.admin.services import AdminAuthService, AuditService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session

router = APIRouter(prefix="/admin", tags=["admin-auth"])


@router.get("/login", response_class=HTMLResponse)
async def login_page(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    error: str | None = None,
):
    admin = await get_current_admin_optional(request, session)
    if admin:
        return RedirectResponse("/admin/", status_code=302)
    return templates.TemplateResponse(
        request,
        "login.html",
        {"error": error},
    )


@router.post("/login")
async def login_submit(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    username: str = Form(...),
    password: str = Form(...),
):
    auth = AdminAuthService(session)
    admin = await auth.authenticate(username.strip(), password)
    if admin is None:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error": "Invalid credentials"},
            status_code=401,
        )
    request.session[SESSION_ADMIN_ID] = str(admin.id)
    request.session[SESSION_ADMIN_USERNAME] = admin.username
    request.session[SESSION_ADMIN_ROLE] = admin.role.value

    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="login",
        target_type="admin",
        target_id=admin.id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse("/admin/", status_code=302)


@router.post("/logout")
async def logout(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_admin),
):
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="logout",
        target_type="admin",
        target_id=admin.id,
        ip_address=get_client_ip(request),
    )
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=302)
