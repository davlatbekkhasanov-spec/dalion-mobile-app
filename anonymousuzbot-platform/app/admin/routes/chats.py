from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.dependencies import AdminContext, require_permission
from app.admin.permissions import Permission
from app.admin.services import AdminChatService
from app.admin.templates_config import templates
from app.api.dependencies.database import get_db_session
from app.models.enums import ChatStatusEnum

router = APIRouter(prefix="/admin/chats", tags=["admin-chats"])


@router.get("", response_class=HTMLResponse)
async def chats_list(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.CHATS_VIEW)),
    chat_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    service = AdminChatService(session)
    parsed_id = None
    if chat_id:
        try:
            parsed_id = UUID(chat_id.strip())
        except ValueError:
            parsed_id = None
    parsed_status = None
    if status:
        try:
            parsed_status = ChatStatusEnum(status)
        except ValueError:
            parsed_status = None
    parsed_from = datetime.fromisoformat(date_from) if date_from else None
    parsed_to = datetime.fromisoformat(date_to) if date_to else None
    chats = await service.search_chats(
        chat_id=parsed_id,
        status=parsed_status,
        date_from=parsed_from,
        date_to=parsed_to,
    )
    return templates.TemplateResponse(
        request,
        "chats/list.html",
        {
            "admin": admin,
            "chats": chats,
            "chat_id": chat_id or "",
            "status": status or "",
            "date_from": date_from or "",
            "date_to": date_to or "",
            "ChatStatusEnum": ChatStatusEnum,
            "title": "Chat Sessions",
        },
    )


@router.get("/{chat_id}", response_class=HTMLResponse)
async def chat_detail(
    request: Request,
    chat_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.CHATS_VIEW)),
):
    service = AdminChatService(session)
    detail = await service.get_chat_detail(chat_id)
    if detail is None:
        return RedirectResponse("/admin/chats", status_code=302)
    return templates.TemplateResponse(
        request,
        "chats/detail.html",
        {
            "admin": admin,
            "detail": detail,
            "title": f"Chat {chat_id}",
        },
    )


@router.get("/{chat_id}/export")
async def export_chat(
    chat_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin: AdminContext = Depends(require_permission(Permission.CHATS_EXPORT)),
):
    service = AdminChatService(session)
    data = await service.export_chat_json(chat_id)
    if data is None:
        return RedirectResponse("/admin/chats", status_code=302)
    return JSONResponse(
        content=data[0],
        headers={"Content-Disposition": f'attachment; filename="chat_{chat_id}.json"'},
    )
