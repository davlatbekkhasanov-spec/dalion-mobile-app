from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, require_permission
from app.admin.permissions import Permission
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.repositories.audit_log_repository import AuditLogRepository

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])


@router.get("", response_class=HTMLResponse)
async def audit_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.AUDIT_VIEW)),
    page: int = 1,
):
    repo = AuditLogRepository(session)
    limit = 100
    offset = max(page - 1, 0) * limit
    logs = await repo.list_recent(limit=limit, offset=offset)
    return templates.TemplateResponse(
        request,
        "audit/list.html",
        {"admin": admin, "logs": logs, "page": page, "title": "Audit Logs"},
    )
