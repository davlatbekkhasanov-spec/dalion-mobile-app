#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
python3 scripts/migrate.py

echo "Starting application..."
exec python main.py
