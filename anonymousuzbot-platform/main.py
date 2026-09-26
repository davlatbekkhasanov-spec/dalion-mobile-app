import asyncio

from app.bot.runner import run_polling
from app.core.config import settings
from app.workers.api_runner import run_api


async def bootstrap() -> None:
    tasks: list = []
    run_mode = settings.run_mode.lower()

    if run_mode in {"all", "api"}:
        tasks.append(run_api())

    if run_mode in {"all", "bot"} and not settings.use_webhook:
        tasks.append(run_polling())

    if not tasks:
        raise RuntimeError(f"Invalid RUN_MODE: {settings.run_mode}")

    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(bootstrap())
