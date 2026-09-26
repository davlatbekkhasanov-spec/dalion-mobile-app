from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.permissions import Permission, has_permission
from app.api.dependencies.database import get_db_session
from app.models.enums import AdminRoleEnum
from app.repositories.admin_user_repository import AdminUserRepository


SESSION_ADMIN_ID = "admin_id"
SESSION_ADMIN_ROLE = "admin_role"
SESSION_ADMIN_USERNAME = "admin_username"


class AuthRedirect(Exception):
    def __init__(self, url: str = "/admin/login") -> None:
        self.url = url


@dataclass
class AdminContext:
    id: UUID
    username: str
    role: AdminRoleEnum


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def get_current_admin_optional(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> AdminContext | None:
    admin_id = request.session.get(SESSION_ADMIN_ID)
    if not admin_id:
        return None
    repo = AdminUserRepository(session)
    admin = await repo.get_by_id(UUID(admin_id))
    if admin is None or not admin.is_active:
        return None
    return AdminContext(id=admin.id, username=admin.username, role=admin.role)


async def require_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> AdminContext:
    admin = await get_current_admin_optional(request, session)
    if admin is None:
        raise AuthRedirect()
    return admin


def require_permission(permission: Permission):
    async def _checker(
        request: Request,
        session: AsyncSession = Depends(get_db_session),
    ) -> AdminContext:
        admin = await get_current_admin_optional(request, session)
        if admin is None:
            raise AuthRedirect()
        if not has_permission(admin.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return admin

    return _checker
