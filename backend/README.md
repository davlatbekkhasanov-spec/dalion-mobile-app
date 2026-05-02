# Backend data source notes

## Product source strategy
- **Current temporary source:** Excel import (`source: "excel"`).
- **Future main source:** DALION Trend sync (`source: "dalion"`).
- No fake/demo DALION data should be introduced in backend services.

## DALION environment variables
- `DALION_ENABLED` — must be `"true"` to enable sync endpoints.
- `DALION_API_URL`
- `DALION_USERNAME`
- `DALION_PASSWORD`

If DALION is not configured, app startup should still work and DALION sync endpoints should return a safe configuration error.

## PostgreSQL persistence (prepared, optional)
- `DB_ENABLED=true` enables PostgreSQL repositories.
- `DATABASE_URL` must be set when DB is enabled.
- If `DB_ENABLED` is not `true` or `DATABASE_URL` is empty, app falls back to local file/memory mode.

### Migration
- SQL migration file: `src/db/migrations/001_init.sql`
- Run manually with your PostgreSQL client, for example:
  - `psql "$DATABASE_URL" -f src/db/migrations/001_init.sql`

No destructive auto-migrations are executed at app startup.
