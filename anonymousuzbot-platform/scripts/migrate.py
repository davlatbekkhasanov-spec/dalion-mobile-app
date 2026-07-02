#!/usr/bin/env python3
"""Run Alembic migrations with broken-schema recovery for Railway."""

from __future__ import annotations

import subprocess
import sys

from sqlalchemy import text

from app.database.session import engine

CORE_TABLES = ["users", "admin_users"]


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


async def orphan_enums_exist() -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT EXISTS (SELECT FROM pg_type t "
                "JOIN pg_namespace n ON n.oid = t.typnamespace "
                "WHERE n.nspname = 'public' AND t.typtype = 'e')"
            )
        )
        return bool(result.scalar())


async def schema_needs_reset() -> bool:
    has_users = await table_exists("users")
    has_alembic = await table_exists("alembic_version")

    if has_users:
        return False

    # Broken partial state: enums or alembic history without core tables.
    if has_alembic or await orphan_enums_exist():
        return True

    return False


async def reset_public_schema() -> None:
    print("Resetting public schema for clean migration")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))


def run_alembic(*args: str) -> int:
    return subprocess.run(["alembic", *args], check=False).returncode


async def main() -> int:
    if await schema_needs_reset():
        await reset_public_schema()

    code = run_alembic("upgrade", "head")
    if code != 0:
        print(f"Migration failed with exit code {code}", file=sys.stderr)
        return code

    for name in CORE_TABLES:
        if not await table_exists(name):
            print(f"Database schema incomplete: missing table {name}", file=sys.stderr)
            return 1

    print("Database schema ready")
    return 0


if __name__ == "__main__":
    import asyncio

    sys.exit(asyncio.run(main()))
