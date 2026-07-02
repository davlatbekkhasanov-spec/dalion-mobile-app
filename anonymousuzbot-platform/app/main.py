from fastapi import FastAPI

from app.api.routes import admin, health, stats
from app.core.config import settings

app = FastAPI(title=settings.app_name, version="1.0.0")
app.include_router(health.router)
app.include_router(stats.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1/admin")


async def run_api() -> None:
    import uvicorn

    config = uvicorn.Config("app.main:app", host=settings.api_host, port=settings.api_port, loop="asyncio")
    server = uvicorn.Server(config)
    await server.serve()
