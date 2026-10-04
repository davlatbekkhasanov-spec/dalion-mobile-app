# AnonymousUzBot Platform

Production-ready anonymous Telegram chat platform with matchmaking, moderation, Mega Admin Panel, AI Moderator, Premium, and Referral rewards.

## Features

### Telegram Bot (Uzbek UI)
- Anonymous registration (gender + age only)
- Male ↔ Female matchmaking via Redis
- Anonymous message relay (no `forward_message`)
- Chat controls: End, Next, Like, Block, Report
- Premium benefits: priority matchmaking, exclusive nicknames, more daily likes, special match effects
- Referral program: invite 3 friends → 7 days Premium

### Mega Admin Panel (`/admin`)
- Secure login with role-based access (`owner`, `mega_admin`, `admin`, `moderator`)
- Users, chats, reports, bans, premium, statistics, audit logs, settings
- AI Moderator signals with severity-based review

### AI Moderator
- Automatic spam/scam/threat/illegal content detection
- Mass-report detection
- Admin review workflow (no auto-ban)

## Stack

- Python 3.12
- Aiogram 3.x
- FastAPI + Uvicorn
- PostgreSQL + SQLAlchemy 2 async
- Redis
- Alembic
- Docker / Railway

## Installation

```bash
git clone <repo>
cd anonymousuzbot-platform
cp .env.example .env
# Edit .env with your values
pip install -r requirements.txt
alembic upgrade head
```

## Local Run

### With Docker Compose

```bash
docker compose up --build
```

Services:
- App: http://localhost:8000
- Health: http://localhost:8000/health
- Admin: http://localhost:8000/admin/login

### Without Docker

Start PostgreSQL and Redis, then:

```bash
export $(grep -v '^#' .env | xargs)
alembic upgrade head
python main.py
```

`RUN_MODE` options:
- `all` — API + bot polling (default, local dev)
- `api` — FastAPI only (webhook production)
- `bot` — Bot polling only

## Railway Deploy

1. Create a Railway project
2. Add **PostgreSQL** and **Redis** plugins
3. Deploy from this repo (Dockerfile)
4. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `DATABASE_URL` | Yes | Postgres URL (auto from plugin) |
| `REDIS_URL` | Yes | Redis URL (auto from plugin) |
| `WEBHOOK_URL` | Prod | Public HTTPS URL, e.g. `https://your-app.up.railway.app` |
| `WEBHOOK_SECRET` | Prod | Random secret for Telegram webhook header |
| `ADMIN_SECRET` | Yes | Session secret for admin panel |
| `ADMIN_BOOTSTRAP_USERNAME` | Yes | First admin username |
| `ADMIN_BOOTSTRAP_PASSWORD` | Yes | First admin password |
| `BOT_USERNAME` | No | Bot username without @ (auto-detected if empty) |
| `OWNER_TELEGRAM_ID` | No | Owner Telegram ID for future alerts |
| `RUN_MODE` | No | `all` or `api` when using webhook |
| `APP_ENV` | Yes | Set to `production` |

5. Railway sets `PORT` automatically — the app reads it
6. On deploy, `scripts/start.sh` runs migrations then starts the app
7. Health check: `GET /health` (checks DB + Redis)

### Webhook mode (recommended for Railway)

```
WEBHOOK_URL=https://your-app.up.railway.app
WEBHOOK_SECRET=your-random-secret
RUN_MODE=api
```

Telegram updates hit `POST /webhook/telegram`.

### Polling mode (simple testing)

Leave `WEBHOOK_URL` empty and use `RUN_MODE=all`.

## Environment Variables

See `.env.example` for the full list.

## Admin Panel Usage

1. Open `/admin/login`
2. Log in with bootstrap credentials (created on first startup)
3. Use the sidebar to manage users, reports, chats, bans, premium, AI signals
4. Change `ADMIN_SECRET` / `ADMIN_SESSION_SECRET` before production

### Roles

| Role | Access |
|------|--------|
| moderator | Reports, AI Moderator |
| admin | + Users, bans, premium, stats |
| mega_admin | + Chats, export, audit logs |
| owner | + Admin accounts, settings |

## Referral System

Each user gets a link:

```
https://t.me/BOT_USERNAME?start=ref_USER_UUID
```

Rules:
- 3 valid invited users → 7 days Premium for inviter
- One reward per invited user
- No self-referral
- Banned users are not counted

Configurable in Settings:
- `referral.required_invites`
- `referral.reward_days`

## Premium

- Stored as `premium_until` datetime
- `user.is_premium` property with auto-expiry check
- Benefits: priority queues, premium nicknames, 30 likes/day (vs 5 free), special match animation

## Security Notes

- **Never expose Telegram ID** to end users in chat — only anonymous nick, gender, age
- Admin panel shows internal UUIDs only (Telegram ID visible to owner/mega_admin)
- Messages are relayed via `send_message`, not forwarded
- Set strong `ADMIN_SECRET` in production
- Rotate `BOT_TOKEN` if leaked
- Use `WEBHOOK_SECRET` in production webhook mode
- All admin actions are audit-logged

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness + DB/Redis check |
| `POST /webhook/telegram` | Telegram webhook (production) |
| `GET /admin/login` | Admin panel |

## Project Structure

```
app/
  bot/          # Telegram handlers, keyboards
  api/          # FastAPI app, health, webhook
  admin/        # Mega Admin Panel
  services/     # Business logic
  repositories/ # Data access
  models/       # SQLAlchemy models
migrations/     # Alembic migrations
scripts/        # start.sh for production
```

## License

Private / project-specific.
