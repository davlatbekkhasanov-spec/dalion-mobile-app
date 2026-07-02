import asyncio

from app.bot.runner import run_bot
from app.workers.api_runner import run_api


async def bootstrap() -> None:
    # In production this can be split into dedicated process types.
    await asyncio.gather(run_api(), run_bot())


if __name__ == "__main__":
    asyncio.run(bootstrap())
