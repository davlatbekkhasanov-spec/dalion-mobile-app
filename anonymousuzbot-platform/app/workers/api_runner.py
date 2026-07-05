import uvicorn

from app.api.app import app
from app.core.config import settings


async def run_api() -> None:
    config = uvicorn.Config(app=app, host=settings.api_host, port=settings.api_port, loop="asyncio")
    server = uvicorn.Server(config)
    await server.serve()
