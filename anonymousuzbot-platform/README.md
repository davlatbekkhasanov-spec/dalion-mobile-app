# AnonymousUzBot Platform

Enterprise-grade anonymous Telegram chat platform (Uzbekistan market) with:

- Aiogram 3.x Telegram bot
- FastAPI admin and ops API
- PostgreSQL + SQLAlchemy 2 + Alembic
- Redis queue for high-throughput matchmaking
- Docker / Railway deployment ready

## Security model

Users never see Telegram profile metadata. Public identity contains only:

- Random anonymous nickname
- Gender
- Age

All internal data uses UUID primary identifiers. Telegram IDs are encrypted at rest.

## Quick start

```bash
cp .env.example .env
# set BOT_TOKEN and other secrets
docker compose up --build
```

## Run migrations

```bash
alembic upgrade head
```

## Run locally

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
python -m app.bot.runner
```

## Railway notes

Set these variables in Railway project:

- `BOT_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- `ADMIN_API_KEY`
- `TELEGRAM_ID_ENCRYPTION_KEY`

Then deploy from this folder.
