# syntax=docker/dockerfile:1.7
# ─── Base ─────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ─── Development (hot-reload) ─────────────────────────────────────────────────
FROM base AS development
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "run", "start:dev"]

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ─── Production deps (no devDeps) ─────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
# Migrations folder needed by the standalone migrator at runtime
COPY --from=builder /app/src/database/migrations ./src/database/migrations
# Entrypoint: runs migrations then starts the server
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
