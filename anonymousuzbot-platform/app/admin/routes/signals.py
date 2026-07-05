from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission, has_permission
from app.admin.services import AdminSignalService, AuditService, ModerationService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.models.enums import SignalSeverityEnum, SignalStatusEnum, SignalTypeEnum

router = APIRouter(prefix="/admin/signals", tags=["admin-signals"])


@router.get("", response_class=HTMLResponse)
async def signals_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_VIEW)),
    severity: str | None = None,
    status: str | None = None,
    page: int = 1,
):
    service = AdminSignalService(session)
    parsed_severity = None
    parsed_status = None
    if severity:
        try:
            parsed_severity = SignalSeverityEnum(severity)
        except ValueError:
            parsed_severity = None
    if status:
        try:
            parsed_status = SignalStatusEnum(status)
        except ValueError:
            parsed_status = None
    signals = await service.list_signals(
        severity=parsed_severity,
        status=parsed_status,
        page=page,
    )
    return templates.TemplateResponse(
        request,
        "signals/list.html",
        {
            "admin": admin,
            "signals": signals,
            "severity": severity or "",
            "status": status or "",
            "page": page,
            "SignalSeverityEnum": SignalSeverityEnum,
            "SignalStatusEnum": SignalStatusEnum,
            "SignalTypeEnum": SignalTypeEnum,
            "title": "AI Moderator",
        },
    )


@router.get("/{signal_id}", response_class=HTMLResponse)
async def signal_detail(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_VIEW)),
):
    service = AdminSignalService(session)
    detail = await service.get_signal_detail(signal_id)
    if detail is None:
        return RedirectResponse("/admin/signals", status_code=302)
    return templates.TemplateResponse(
        request,
        "signals/detail.html",
        {
            "admin": admin,
            "detail": detail,
            "can_manage": has_permission(admin.role, Permission.SIGNALS_MANAGE),
            "title": f"Signal {signal_id}",
        },
    )


@router.post("/{signal_id}/ignore")
async def ignore_signal(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_MANAGE)),
):
    service = AdminSignalService(session)
    await service.ignore_signal(signal_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="ignore_moderation_signal",
        target_type="moderation_signal",
        target_id=signal_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/signals/{signal_id}", status_code=302)


@router.post("/{signal_id}/resolve")
async def resolve_signal(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_MANAGE)),
):
    service = AdminSignalService(session)
    await service.resolve_signal(signal_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="resolve_moderation_signal",
        target_type="moderation_signal",
        target_id=signal_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/signals/{signal_id}", status_code=302)


@router.post("/{signal_id}/warn")
async def warn_from_signal(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_MANAGE)),
):
    service = AdminSignalService(session)
    detail = await service.get_signal_detail(signal_id)
    if detail:
        user_id = detail["signal"].user_id
        mod = ModerationService(session)
        await mod.warn_user(user_id)
        await service.resolve_signal(signal_id)
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="warn_user_from_signal",
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/signals/{signal_id}", status_code=302)


@router.post("/{signal_id}/temp-ban")
async def temp_ban_from_signal(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_MANAGE)),
    reason: str = Form("AI moderation violation"),
    days: int = Form(7),
):
    service = AdminSignalService(session)
    detail = await service.get_signal_detail(signal_id)
    if detail:
        user_id = detail["signal"].user_id
        mod = ModerationService(session)
        await mod.temp_ban_user(user_id, reason, days=days)
        await service.resolve_signal(signal_id)
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="temp_ban_user_from_signal",
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/signals/{signal_id}", status_code=302)


@router.post("/{signal_id}/perm-ban")
async def perm_ban_from_signal(
    request: Request,
    signal_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.SIGNALS_MANAGE)),
    reason: str = Form("AI moderation violation"),
):
    service = AdminSignalService(session)
    detail = await service.get_signal_detail(signal_id)
    if detail:
        user_id = detail["signal"].user_id
        mod = ModerationService(session)
        await mod.permanent_ban_user(user_id, reason)
        await service.resolve_signal(signal_id)
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="perm_ban_user_from_signal",
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/signals/{signal_id}", status_code=302)
