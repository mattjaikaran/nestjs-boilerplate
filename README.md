# NestJS Boilerplate

Production-ready NestJS API with comprehensive auth. Built on a Rust-powered toolchain for maximum performance.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | NestJS 10 + **Fastify** | 2-3x faster than Express, built-in schema validation, fast-json-stringify |
| Compiler | **SWC** (Rust-based) | Replaces tsc — 10-70x faster builds |
| Linter/Formatter | **Biome** (Rust-based) | Replaces ESLint + Prettier in one tool, ~100x faster |
| ORM | TypeORM + PostgreSQL | Production-tested, full TypeScript support |
| Auth | JWT + argon2 + TOTP + WebAuthn | Covers every modern auth pattern |
| Package manager | **bun** | Fast installs, native TypeScript runner |

## Auth Methods

- Email + password (argon2 hash)
- Access + refresh JWT tokens with rotation
- Email verification via OTP
- Forgot/reset password via OTP
- Magic link (passwordless email login)
- Google OAuth 2.0
- GitHub OAuth 2.0
- WebAuthn — Touch ID, Face ID, hardware keys (FIDO2/Passkeys)

## Quick Start

```bash
# 1. Clone and install
git clone <repo> nestjs-boilerplate && cd nestjs-boilerplate
make setup          # bun install + copy .env.example → .env

# 2. Start PostgreSQL
make docker-up      # docker compose up -d postgres redis

# 3. Start dev server
make dev            # nest start --watch

# API:   http://localhost:3000/api/v1
# Docs:  http://localhost:3000/docs
```

Or use the quickstart script:
```bash
bash scripts/quickstart.sh
```

## Project Structure

```
src/
├── main.ts                  # Fastify bootstrap, Swagger, global pipes
├── app.module.ts            # Root module — throttle, guards, config
├── config/                  # Typed config with registerAs
├── common/                  # Guards, decorators, filters, interceptors
├── database/                # TypeORM module, BaseEntity
├── auth/                    # Full auth system (see docs/auth.md)
├── users/                   # User CRUD + profile
├── todos/                   # Example resource with pagination
└── health/                  # Terminus health check endpoint
```

## API Endpoints

### Auth `/api/v1/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | - | Register email/password |
| POST | /login | - | Login email/password |
| POST | /refresh | - | Rotate tokens |
| POST | /logout | JWT | Revoke tokens |
| GET | /me | JWT | Current user |
| POST | /forgot-password | - | Send reset OTP |
| POST | /reset-password | - | Reset with OTP token |
| GET | /verify-email/:token | - | Verify email |
| POST | /magic-link | - | Send magic link |
| GET | /magic-link/:token | - | Auth via magic link |
| GET | /google | - | Google OAuth redirect |
| GET | /google/callback | - | Google OAuth callback |
| GET | /github | - | GitHub OAuth redirect |
| GET | /github/callback | - | GitHub OAuth callback |
| POST | /webauthn/register/options | JWT | Get WebAuthn reg options |
| POST | /webauthn/register/verify | JWT | Verify WebAuthn reg |
| POST | /webauthn/authenticate/options | - | Get WebAuthn auth options |
| POST | /webauthn/authenticate/verify | - | Touch ID / Face ID login |

### Users `/api/v1/users`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /me | JWT | Get profile |
| PATCH | /me | JWT | Update profile |
| DELETE | /me | JWT | Delete account |
| GET | / | Admin | List all users |
| GET | /:id | Admin | Get user by ID |

### Todos `/api/v1/todos`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | JWT | Create todo |
| GET | / | JWT | List with pagination |
| GET | /stats | JWT | Get stats |
| GET | /:id | JWT | Get by ID |
| PATCH | /:id | JWT | Update |
| DELETE | /:id | JWT | Soft delete |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/health | - | DB health check |

## Environment Variables

See `.env.example` for full list. Key vars:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_boilerplate
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<different-strong-secret>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000
```

## Development

```bash
make dev          # watch mode
make lint         # biome lint
make lint-fix     # auto-fix
make format       # biome format
make test         # unit tests
make test-cov     # coverage
make test-e2e     # e2e tests (requires running DB)
```

## Database

```bash
make docker-up    # start postgres + redis
make db-reset     # drop + recreate schema
make db-seed      # seed 1 admin + 3 users + 5 todos each
make db-down      # stop postgres
```

Seed credentials: `admin@example.com`, `alice@example.com`, `bob@example.com`, `charlie@example.com` — all use `Password123!`

## Generating a New Module

```bash
make generate
# or: bun run generate
```

Interactive CLI scaffolds module, controller, service, entity, and DTOs. Then:
1. Add the entity to `src/database/database.module.ts`
2. Import the module in `src/app.module.ts`

## Docker

```bash
make docker-up       # postgres + redis only (recommended for local dev)
docker compose --profile full up -d   # includes API container
make docker-down
make docker-logs
```

## Production Build

```bash
make build           # SWC compile → dist/
make start           # node dist/main
```

Set `NODE_ENV=production` to disable:
- TypeORM `synchronize` (use migrations instead)
- Swagger docs

## Auth Details

See [docs/auth.md](docs/auth.md) for full documentation on WebAuthn, OTP flows, OAuth setup, and token strategy.

## Performance Notes

- **Fastify** over Express: ~2-3x higher throughput, lower latency
- **SWC** compiler: cold builds in ~500ms vs ~8s with tsc
- **Biome**: linting a large codebase in ~50ms vs ~5s with ESLint
- **argon2** over bcrypt: more memory-hard, resistant to GPU attacks
- Response transform interceptor adds `{ success, data, timestamp }` wrapper — remove it if you need raw responses on hot paths
