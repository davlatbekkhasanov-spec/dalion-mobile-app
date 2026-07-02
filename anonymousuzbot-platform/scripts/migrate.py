#!/usr/bin/env python3
"""Run Alembic migrations with legacy-schema recovery for Railway."""

from __future__ import annotations

import subprocess
import sys

from sqlalchemy import text

from app.database.session import engine


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


async def detect_stamp_revision() -> str | None:
    for table, revision in REVISIONS:
        if await table_exists(table):
            return revision
    if await type_exists("gender_enum"):
        return "20260702_0002"
    return None


def run_alembic(*args: str) -> int:
    result = subprocess.run(["alembic", *args], check=False)
    return result.returncode


async def main() -> int:
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
