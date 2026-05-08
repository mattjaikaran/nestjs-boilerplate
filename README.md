# NestJS Boilerplate

Production-ready NestJS 11 API. Fastify transport, Drizzle ORM, comprehensive auth, CQRS, real-time events, background queues, Stripe payments, and Prometheus metrics — all wired up and tested.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **NestJS 11** + Fastify | 2-3x faster than Express; built-in schema validation |
| Compiler | **SWC** (Rust) | 10-70x faster builds vs tsc |
| Linter/Formatter | **Biome** (Rust) | Replaces ESLint + Prettier, ~100x faster |
| ORM | **Drizzle ORM** + PostgreSQL | Type-safe, lightweight, SQL-first |
| Auth | JWT + argon2 + TOTP + WebAuthn | Every modern auth pattern covered |
| Queue | **BullMQ** + Redis | Reliable background job processing |
| Cache | **Redis** via cache-manager | Distributed caching with in-memory fallback |
| Real-time | **Socket.io** (WebSockets) | JWT-authenticated push notifications |
| Payments | **Stripe** | Checkout sessions, portals, webhooks |
| Metrics | **Prometheus** via prom-client | Request duration, auth counters, queue counters |
| Package manager | **bun** | Fast installs, native TS runner |

## Feature Overview

| Feature | Status |
|---------|--------|
| Email/password auth | ✓ |
| JWT access + refresh tokens | ✓ |
| Google + GitHub OAuth | ✓ |
| WebAuthn (Touch ID / Face ID / passkeys) | ✓ |
| TOTP (authenticator app 2FA) | ✓ |
| Magic link (passwordless) | ✓ |
| Email verification OTP | ✓ |
| Account lockout (brute-force protection) | ✓ |
| API key authentication | ✓ |
| RBAC (roles + fine-grained permissions) | ✓ |
| Rate limiting (short/medium/long windows) | ✓ |
| CQRS (command/query bus in todos) | ✓ |
| Domain events (user.*, todo.*) | ✓ |
| Request context (correlation IDs) | ✓ |
| Background email queue | ✓ |
| Redis cache module | ✓ |
| Cron scheduler (token purge, archival) | ✓ |
| WebSocket notifications gateway | ✓ |
| Stripe checkout + portal + webhooks | ✓ |
| File uploads (multipart, local storage) | ✓ |
| Audit logging | ✓ |
| Prometheus metrics endpoint | ✓ |
| Response compression (brotli/gzip) | ✓ |
| Security headers (helmet) | ✓ |
| Graceful shutdown | ✓ |
| Swagger UI (dev only) | ✓ |
| Health check endpoint | ✓ |

## Quick Start

```bash
# 1. Clone and install
git clone <repo> nestjs-boilerplate && cd nestjs-boilerplate
make setup          # bun install + copy .env.example → .env

# 2. Start infrastructure
make docker-up      # postgres + redis

# 3. Initialize database
make db-reset       # create schema
make db-seed        # seed admin + sample data

# 4. Start dev server
make dev

# API:   http://localhost:3000/api/v1
# Docs:  http://localhost:3000/docs
```

Or run the quickstart script:
```bash
bash scripts/quickstart.sh
```

## Project Structure

```
src/
├── main.ts                  # Fastify bootstrap — helmet, compress, swagger, cors
├── app.module.ts            # Root module — global guards, throttling
├── config/                  # Typed config with registerAs (app, db, jwt, auth, redis, stripe)
├── common/
│   ├── base/                # AbstractCrudService + AbstractCrudController
│   ├── context/             # AsyncLocalStorage request context + correlation IDs
│   ├── decorators/          # @Public, @Roles, @Permissions, @CurrentUser, @Audit
│   ├── dto/                 # PaginationDto
│   ├── events/              # DomainEvent base, user.* and todo.* events, central listener
│   ├── filters/             # HttpExceptionFilter
│   ├── guards/              # JwtAuthGuard, RolesGuard, PermissionsGuard, ApiKeyGuard
│   ├── interceptors/        # RequestContext, Logging, ResponseTransform, Timeout, Audit
│   ├── pipes/               # ValidationPipe wrapper
│   └── types/               # Shared TypeScript types
├── database/
│   ├── drizzle.module.ts    # postgres.js + Drizzle ORM
│   └── schema/              # users, auth, todos, audit, payments, api-keys schemas
├── auth/                    # Full auth system (see docs/auth.md)
│   ├── strategies/          # JWT, JWT-refresh, local, Google, GitHub
│   ├── guards/              # LocalAuth, JwtRefresh, GoogleOAuth, GithubOAuth
│   ├── dto/                 # Register, login, OTP, TOTP, WebAuthn, magic-link DTOs
│   ├── auth.service.ts      # Core auth logic + event emission
│   ├── token.service.ts     # JWT generation + refresh rotation
│   ├── otp.service.ts       # OTP create/verify (email verification, password reset)
│   ├── totp.service.ts      # TOTP setup + verification (authenticator apps)
│   ├── webauthn.service.ts  # SimpleWebAuthn — passkey registration + authentication
│   ├── lockout.service.ts   # Redis-backed account lockout
│   └── api-key.service.ts   # API key generation + validation
├── users/                   # User CRUD + profile management + API key endpoints
├── todos/                   # CQRS example resource
│   ├── commands/            # CreateTodoCommand, UpdateTodoCommand, DeleteTodoCommand
│   ├── queries/             # GetTodoQuery, ListTodosQuery
│   └── handlers/            # Command + query handlers
├── cache/                   # Redis-backed cache module (falls back to in-memory)
├── redis/                   # Shared ioredis client module
├── queue/                   # BullMQ email queue — processor, service, constants
├── email/                   # Resend email service
├── scheduler/               # Cron jobs — token purge, OTP purge, todo archival
├── notifications/           # Socket.io gateway with JWT auth
├── payments/                # Stripe checkout, portal, webhook handler
├── uploads/                 # Multipart file uploads with local storage
├── audit/                   # Audit log read service
├── metrics/                 # Prometheus counters + histograms
└── health/                  # Terminus health check
```

## API Endpoints

### Auth `/api/v1/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | — | Register with email + password |
| POST | /login | — | Login; returns tokens (or TOTP challenge) |
| POST | /refresh | — | Rotate token pair |
| POST | /logout | JWT | Revoke current refresh token |
| GET | /me | JWT | Current user profile |
| POST | /forgot-password | — | Send password reset OTP |
| POST | /reset-password | — | Reset password with OTP |
| GET | /verify-email/:token | — | Verify email address |
| POST | /magic-link | — | Send magic link email |
| GET | /magic-link/:token | — | Authenticate via magic link |
| GET | /google | — | Google OAuth redirect |
| GET | /google/callback | — | Google OAuth callback |
| GET | /github | — | GitHub OAuth redirect |
| GET | /github/callback | — | GitHub OAuth callback |
| POST | /totp/setup | JWT | Generate TOTP secret + QR code |
| POST | /totp/enable | JWT | Enable TOTP after verifying first code |
| POST | /totp/verify | — | Complete login with TOTP code |
| POST | /totp/disable | JWT | Disable TOTP |
| POST | /webauthn/register/options | JWT | Get passkey registration options |
| POST | /webauthn/register/verify | JWT | Verify + store passkey |
| POST | /webauthn/authenticate/options | — | Get passkey authentication options |
| POST | /webauthn/authenticate/verify | — | Authenticate with passkey |

### Users `/api/v1/users`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /me | JWT | Get own profile |
| PATCH | /me | JWT | Update own profile |
| DELETE | /me | JWT | Delete own account |
| GET | / | Admin | List all users |
| GET | /:id | Admin | Get user by ID |
| POST | /me/api-keys | JWT | Create API key |
| GET | /me/api-keys | JWT | List own API keys |
| DELETE | /me/api-keys/:id | JWT | Revoke API key |

### Todos `/api/v1/todos`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | JWT | Create todo (via CommandBus) |
| GET | / | JWT | List with filtering and pagination (via QueryBus) |
| GET | /stats | JWT | Aggregated stats (total, completed, pending, overdue, byPriority) |
| GET | /:id | JWT | Get by ID (via QueryBus) |
| POST | /:id/toggle | JWT | Toggle completion status |
| PATCH | /:id/toggle | JWT | Toggle completion status (react-vite alias) |
| PATCH | /:id | JWT | Update (via CommandBus) |
| DELETE | /:id | JWT | Soft delete (via CommandBus) |
| PATCH | /bulk | JWT | Bulk update by IDs |
| POST | /bulk-delete | JWT | Bulk soft delete by IDs |
| DELETE | /bulk | JWT | Bulk soft delete by IDs (react-vite alias) |
| POST | /archive-completed | JWT | Archive (soft delete) all completed todos |

Query params for `GET /`: `search`, `priority` (low/medium/high), `completed` (bool), `overdue` (bool), `due_today` (bool), `page`, `limit`, `sortBy`, `sortOrder`.

Response shape includes both `isCompleted` (DB field) and `completed` (frontend-friendly alias).

### Payments `/api/v1/payments`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /checkout | JWT | Create Stripe checkout session |
| POST | /portal | JWT | Create Stripe billing portal session |
| POST | /webhook | — | Stripe webhook handler |

### Uploads `/api/v1/uploads`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | JWT | Upload file (multipart/form-data) |
| GET | /:filename | JWT | Serve uploaded file |

### System
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/health | — | DB + Redis health check |
| GET | /metrics | — | Prometheus metrics scrape endpoint |

## Environment Variables

See `.env.example` for the full list. Key variables by category:

```env
# App
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_boilerplate
DB_SSL=false

# JWT
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<different min 32 chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis
REDIS_URL=redis://localhost:6379

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# WebAuthn
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Development

```bash
make dev          # watch mode (SWC)
make lint         # biome lint
make lint-fix     # auto-fix
make test         # unit tests (jest)
make test-cov     # with coverage
make test-e2e     # e2e tests (requires running DB + Redis)
make typecheck    # tsc --noEmit
```

## Database

```bash
make docker-up    # start postgres + redis
make db-reset     # drop + recreate schema (dev only — unsafe in prod)
make db-seed      # seed: 1 admin + 3 users + todos
make db-down      # stop containers
```

Seed credentials (all use `Password123!`):
- `admin@example.com` (admin role)
- `alice@example.com`, `bob@example.com`, `charlie@example.com`

### Migrations

Migration files live in `src/database/migrations/`. **Never use `db:push` in production** — it mutates the schema without a history and cannot be rolled back.

```bash
# Development workflow
bun run db:generate   # diff schema → new SQL migration file
bun run db:migrate    # apply pending migrations to the database
bun run db:studio     # open Drizzle Studio (visual DB browser)

# First-time setup (same as make db-reset, but explicit)
bun run db:migrate
bun run db:seed
```

**Deploy pattern**: run `bun run db:migrate` before the new binary starts. In Docker:

```bash
docker compose exec api bun run db:migrate
```

In CI/CD (Railway, Fly.io), add a release command that runs migrations before the new instance accepts traffic. See [docs/deploy.md](docs/deploy.md) for platform-specific instructions.

## Generating a New Module

```bash
make generate
# or: bun run generate
```

Interactive CLI scaffolds module, controller, service, schema, and DTOs. Then:
1. Export the new schema from `src/database/schema/index.ts`
2. Import the module in `src/app.module.ts`

## Docker

```bash
make docker-up                         # postgres + redis (recommended for local dev)
docker compose --profile full up -d    # includes API container
make docker-down
make docker-logs
```

## Production Build

```bash
make build    # SWC compile → dist/
make start    # node dist/main
```

In `production` mode:
- Drizzle `synchronize` is disabled (use `db:migrate`)
- Swagger UI is disabled
- CSP headers are enabled via helmet

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/auth.md](docs/auth.md) | Auth flows, WebAuthn, TOTP, OAuth setup, token strategy, API keys, account lockout |
| [docs/features.md](docs/features.md) | CQRS, domain events, cache, queue, WebSockets, scheduler, metrics |
| [docs/architecture.md](docs/architecture.md) | System design, request lifecycle, module dependency map |
| [docs/deploy.md](docs/deploy.md) | Docker, Fly.io, Railway deployment guides |

## Performance

- **Fastify** over Express: ~2-3x higher throughput, lower latency
- **SWC** compiler: cold builds in ~500ms vs ~8s with tsc
- **Biome**: linting in ~50ms vs ~5s with ESLint
- **argon2** over bcrypt: more memory-hard, GPU-resistant
- **Drizzle** over TypeORM: near-zero runtime overhead, SQL-first query building
- **@fastify/compress**: brotli/gzip compression on all responses
- Response transform interceptor adds `{ success, data, correlationId, timestamp }` — strip it on hot paths if needed
