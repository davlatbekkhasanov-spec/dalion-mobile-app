import redis.asyncio as redis

from app.core.config import settings


redis_client = redis.from_url(settings.redis_url, decode_responses=True)


async def ping_redis() -> bool:
    # Health check helper and future matchmaking queue readiness check.
    return bool(await redis_client.ping())
