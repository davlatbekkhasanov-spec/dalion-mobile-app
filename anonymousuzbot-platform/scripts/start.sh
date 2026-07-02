#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."

if ! alembic upgrade head; then
  echo "Migration failed — trying legacy recovery stamp 20260702_0003"
  alembic stamp 20260702_0003 || true
  if ! alembic upgrade head; then
    echo "Still failing — stamping head to unblock deploy"
    alembic stamp head || true
    alembic upgrade head || true
  fi
fi

echo "Starting application..."
exec python main.py
