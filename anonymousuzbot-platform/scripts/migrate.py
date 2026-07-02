#!/usr/bin/env python3
"""Run Alembic migrations with legacy-schema recovery for Railway."""

from __future__ import annotations

import subprocess
import sys

from sqlalchemy import text

from app.database.session import engine


REVISIONS = [
    ("admin_users", "20260702_0004"),
    ("moderation_signals", "20260702_0005"),
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


async def detect_stamp_revision() -> str | None:
    for table, revision in REVISIONS:
        if await table_exists(table):
            return revision
    return None


async def alembic_version_exists() -> bool:
    return await table_exists("alembic_version")


def run_alembic(*args: str) -> int:
    result = subprocess.run(["alembic", *args], check=False)
    return result.returncode


async def main() -> int:
    if await alembic_version_exists():
        return run_alembic("upgrade", "head")

    if await table_exists("users"):
        revision = await detect_stamp_revision()
        if revision:
            print(f"Legacy schema detected — stamping {revision}")
            code = run_alembic("stamp", revision)
            if code != 0:
                return code

    return run_alembic("upgrade", "head")


if __name__ == "__main__":
    import asyncio

    code = asyncio.run(main())
    if code != 0:
        print(f"Migration failed with exit code {code}", file=sys.stderr)
    sys.exit(code)
