from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _normalize_async_database_url(url: str) -> str:
    # Railway Postgres commonly exposes `postgres://` or `postgresql://`.
    # Force async SQLAlchemy driver explicitly to avoid psycopg2 fallback.
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    return url


engine = create_async_engine(
    _normalize_async_database_url(settings.database_url),
    pool_pre_ping=True,
    pool_size=50,
    max_overflow=100,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
