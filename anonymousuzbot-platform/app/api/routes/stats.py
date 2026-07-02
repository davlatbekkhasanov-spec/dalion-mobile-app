from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db_session
from app.models.chat import ChatSession
from app.models.report import ModerationCase
from app.models.user import User

router = APIRouter(tags=["stats"])


@router.get("/stats/overview")
async def stats_overview(session: AsyncSession = Depends(get_db_session)) -> dict:
    users = (await session.execute(select(func.count(User.id)))).scalar_one()
    chats = (await session.execute(select(func.count(ChatSession.id)))).scalar_one()
    reports = (await session.execute(select(func.count(ModerationCase.id)))).scalar_one()
    return {"users": users, "chats": chats, "reports": reports}
