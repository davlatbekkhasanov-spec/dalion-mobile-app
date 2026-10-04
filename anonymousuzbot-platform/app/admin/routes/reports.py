from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, get_client_ip, require_permission
from app.admin.permissions import Permission, has_permission
from app.admin.services import AdminReportService, AuditService, ModerationService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.models.enums import ReportStatusEnum

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])


@router.get("", response_class=HTMLResponse)
async def reports_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_VIEW)),
    status: str | None = None,
):
    service = AdminReportService(session)
    parsed_status = None
    if status:
        try:
            parsed_status = ReportStatusEnum(status)
        except ValueError:
            parsed_status = None
    reports = await service.list_reports(status=parsed_status)
    return templates.TemplateResponse(
        request,
        "reports/list.html",
        {
            "admin": admin,
            "reports": reports,
            "status": status or "",
            "ReportStatusEnum": ReportStatusEnum,
            "title": "Reports",
        },
    )


@router.get("/{report_id}", response_class=HTMLResponse)
async def report_detail(
    request: Request,
    report_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_VIEW)),
):
    service = AdminReportService(session)
    detail = await service.get_report_detail(report_id)
    if detail is None:
        return RedirectResponse("/admin/reports", status_code=302)
    mod = ModerationService(session)
    await mod.set_report_reviewing(report_id)
    return templates.TemplateResponse(
        request,
        "reports/detail.html",
        {
            "admin": admin,
            "detail": detail,
            "can_manage": has_permission(admin.role, Permission.REPORTS_MANAGE),
            "title": f"Report {report_id}",
        },
    )


@router.post("/{report_id}/approve")
async def approve_report(
    request: Request,
    report_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_MANAGE)),
):
    mod = ModerationService(session)
    await mod.approve_report(report_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="approve_report",
        target_type="report",
        target_id=report_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/reports/{report_id}", status_code=302)


@router.post("/{report_id}/reject")
async def reject_report(
    request: Request,
    report_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_MANAGE)),
):
    mod = ModerationService(session)
    await mod.reject_report(report_id)
    audit = AuditService(session)
    await audit.log(
        admin_id=admin.id,
        action="reject_report",
        target_type="report",
        target_id=report_id,
        ip_address=get_client_ip(request),
    )
    return RedirectResponse(f"/admin/reports/{report_id}", status_code=302)


@router.post("/{report_id}/ban")
async def ban_reported_user(
    request: Request,
    report_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_MANAGE)),
    reason: str = Form("Reported violation"),
    permanent: str = Form("false"),
):
    service = AdminReportService(session)
    detail = await service.get_report_detail(report_id)
    if detail:
        mod = ModerationService(session)
        user_id = detail["report"].reported_user_id
        if permanent == "true":
            await mod.permanent_ban_user(user_id, reason)
            action = "ban_user_from_report_permanent"
        else:
            await mod.temp_ban_user(user_id, reason)
            action = "ban_user_from_report_temp"
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action=action,
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/reports/{report_id}", status_code=302)


@router.post("/{report_id}/warn")
async def warn_reported_user(
    request: Request,
    report_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.REPORTS_MANAGE)),
):
    service = AdminReportService(session)
    detail = await service.get_report_detail(report_id)
    if detail:
        user_id = detail["report"].reported_user_id
        audit = AuditService(session)
        await audit.log(
            admin_id=admin.id,
            action="warn_user_from_report",
            target_type="user",
            target_id=user_id,
            ip_address=get_client_ip(request),
        )
    return RedirectResponse(f"/admin/reports/{report_id}", status_code=302)
