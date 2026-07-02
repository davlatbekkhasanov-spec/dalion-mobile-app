import asyncio

from app.bot.runner import run_bot
from app.main import run_api


async def main() -> None:
    await asyncio.gather(run_api(), run_bot())


if __name__ == "__main__":
    asyncio.run(main())
