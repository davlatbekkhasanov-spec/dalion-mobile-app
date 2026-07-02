#!/usr/bin/env python3
"""Run Alembic migrations with broken-schema recovery for Railway."""

from __future__ import annotations

import subprocess
import sys

from sqlalchemy import text

from app.database.session import engine

ENUM_TYPES = [
    "signal_status_enum",
    "signal_severity_enum",
    "signal_type_enum",
    "admin_role_enum",
    "ban_type_enum",
    "report_status_enum",
    "message_type_enum",
    "chat_status_enum",
    "gender_enum",
]

REVISIONS = [
    ("moderation_signals", "20260702_0005"),
    ("admin_users", "20260702_0004"),
    ("secret_matches", "20260702_0003"),
    ("users", "20260702_0002"),
]


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


async def type_exists(name: str) -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT EXISTS (SELECT FROM pg_type WHERE typname = :name)"),
            {"name": name},
        )
        return bool(result.scalar())


async def reset_broken_enums() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        for enum_name in ENUM_TYPES:
            await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))


async def detect_stamp_revision() -> str | None:
    for table, revision in REVISIONS:
        if await table_exists(table):
            return revision
    return None


def run_alembic(*args: str) -> int:
    return subprocess.run(["alembic", *args], check=False).returncode


async def main() -> int:
    if await type_exists("gender_enum") and not await table_exists("users"):
        print("Broken schema detected (enums without tables) — resetting enums")
        await reset_broken_enums()

    code = run_alembic("upgrade", "head")
    if code == 0:
        return 0

    revision = await detect_stamp_revision()
    if revision is None:
        print("Migration failed with no recoverable schema", file=sys.stderr)
        return code

    print(f"Migration recovery: stamping {revision}")
    if run_alembic("stamp", revision) != 0:
        return 1
    return run_alembic("upgrade", "head")


if __name__ == "__main__":
    import asyncio

    sys.exit(asyncio.run(main()))
