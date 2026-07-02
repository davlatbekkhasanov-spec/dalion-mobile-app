from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.session import get_db_session
from app.models.report import ModerationCase
from app.models.user import User

router = APIRouter(tags=["admin"])


def require_admin(x_api_key: str = Header(default="")) -> None:
    if x_api_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/users", dependencies=[Depends(require_admin)])
async def admin_users(session: AsyncSession = Depends(get_db_session)) -> list[dict]:
    rows = (await session.execute(select(User))).scalars().all()
    return [{"id": str(u.id), "status": u.status.value, "created_at": u.created_at.isoformat()} for u in rows]


@router.get("/reports", dependencies=[Depends(require_admin)])
async def admin_reports(session: AsyncSession = Depends(get_db_session)) -> list[dict]:
    rows = (await session.execute(select(ModerationCase))).scalars().all()
    return [
        {
            "id": str(r.id),
            "chat_id": str(r.chat_id),
            "reporter_id": str(r.reporter_id),
            "reported_id": str(r.reported_id),
            "status": r.status.value,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
