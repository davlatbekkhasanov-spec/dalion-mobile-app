from sqlalchemy import text
from fastapi import APIRouter

from app.database.redis import ping_redis
from app.database.session import SessionLocal
from app.schemas.health import HealthResponse
from app.utils.constants import SERVICE_NAME

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    database = False
    redis = False

    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
            database = True
    except Exception:
        database = False

    try:
        redis = await ping_redis()
    except Exception:
        redis = False

    return HealthResponse(
        ok=database and redis,
        service=SERVICE_NAME,
        database=database,
        redis=redis,
    )
