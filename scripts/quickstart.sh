#!/usr/bin/env bash
set -euo pipefail

echo "NestJS Boilerplate - Quickstart"
echo "================================"

# 1. Install deps
echo "1. Installing dependencies..."
bun install

# 2. Copy .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   .env created — edit with your values"
else
  echo "   .env already exists"
fi

# 3. Start postgres
echo "2. Starting PostgreSQL..."
docker compose up -d postgres
echo "   Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U postgres 2>/dev/null; do
  sleep 1
done

# 4. Start dev server
echo "3. Starting development server..."
echo ""
echo "API:   http://localhost:3000/api/v1"
echo "Docs:  http://localhost:3000/docs"
echo ""
bun run start:dev
