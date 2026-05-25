#!/bin/sh
set -e

echo "Running database migrations..."
uv run alembic upgrade head

if [ ! -f /data/.seeded ]; then
  echo "Seeding database with defaults..."
  uv run python -m app.seed.run
  touch /data/.seeded
fi

echo "Starting LedgerLine API..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
