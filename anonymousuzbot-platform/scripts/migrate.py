#!/usr/bin/env python3
"""Run Alembic migrations with broken-schema recovery for Railway."""

from __future__ import annotations

import subprocess
import sys

from sqlalchemy import text

from app.database.session import engine

REQUIRED_TABLES = ["users", "admin_users", "moderation_signals"]


async def table_exists(name: str) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :name)"
            ),
            {"name": name},
        )
        return bool(result.scalar())


async def alembic_version_exists() -> bool:
    return await table_exists("alembic_version")


async def schema_is_complete() -> bool:
    for name in REQUIRED_TABLES:
        if not await table_exists(name):
            return False
    return True


async def reset_public_schema() -> None:
    print("Resetting public schema for clean migration")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))


def run_alembic(*args: str) -> int:
    return subprocess.run(["alembic", *args], check=False).returncode


async def main() -> int:
    if not await schema_is_complete():
        await reset_public_schema()

    code = run_alembic("upgrade", "head")
    if code != 0:
        print(f"Migration failed with exit code {code}", file=sys.stderr)
        return code

    if not await schema_is_complete():
        print("Database schema incomplete after migration", file=sys.stderr)
        return 1

    print("Database schema ready")
    return 0


if __name__ == "__main__":
    import asyncio

    sys.exit(asyncio.run(main()))
