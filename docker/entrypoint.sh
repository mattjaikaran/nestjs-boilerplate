#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node dist/database/migrate.js

echo "[entrypoint] Starting API..."
exec node dist/main
