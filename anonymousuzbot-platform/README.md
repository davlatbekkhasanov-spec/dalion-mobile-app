# Telegram Anonymous Chat (Architecture Skeleton)

Production-oriented architecture skeleton for an anonymous Telegram chat platform.

## Stack
- Python 3.12
- aiogram 3.x
- FastAPI
- PostgreSQL
- Redis
- SQLAlchemy 2 (async)
- Alembic
- Docker / Railway

## Included in this stage
- Clean folder structure
- Environment configuration
- Async PostgreSQL and Redis connections
- Telegram bot startup skeleton
- FastAPI startup skeleton
- Health endpoint: `GET /health`

Response:
```json
{"ok": true, "service": "anonymous-chat"}
```

## Quick start
```bash
cp .env.example .env
docker compose up --build
```

## Railway
Set all variables from `.env.example` in Railway service settings.
Use the same start command:
```bash
python main.py
```
