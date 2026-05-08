# NestJS Boilerplate — Task Tracker

## Completed
- [x] NestJS v11 setup with Fastify adapter
- [x] SWC compiler (Rust-based, ~65ms builds)
- [x] Biome linter/formatter (Rust-based, replaces ESLint + Prettier)
- [x] Drizzle ORM with PostgreSQL schema
- [x] Database migrations with drizzle-kit
- [x] JWT auth (access + refresh tokens with rotation)
- [x] Email/password login with argon2 hashing
- [x] OTP email verification + password reset
- [x] Magic link / passwordless auth
- [x] Google OAuth 2.0
- [x] GitHub OAuth 2.0
- [x] WebAuthn / Passkeys (Touch ID, Face ID) via @simplewebauthn/server
- [x] Global JWT guard + public route decorator
- [x] Role-based access control (RBAC) guard + decorator
- [x] Response transform interceptor (consistent { success, data, timestamp })
- [x] HTTP exception filter with structured errors
- [x] Rate limiting with @nestjs/throttler
- [x] Swagger / OpenAPI docs at /docs
- [x] Users CRUD (admin-only list/get)
- [x] Todos CRUD with pagination, search, soft delete, stats
- [x] Health check endpoint
- [x] Docker Compose (dev + prod)
- [x] Dockerfile (multi-stage: dev + production)
- [x] GitHub Actions CI (lint, test, e2e, build)
- [x] GitHub Actions deploy workflow
- [x] Seed script (admin + 3 users + 5 todos each)
- [x] DB reset script
- [x] Module generator script
- [x] Makefile (50+ commands)
- [x] Deploy docs (Docker, Fly.io, Railway)
- [x] Auth docs
- [x] .env.example with all variables
- [x] Email service integration (Resend via EmailService)
- [x] TOTP / Authenticator app (otplib + QR code setup)
- [x] RBAC permissions guard + decorator
- [x] Rate limiting with @nestjs/throttler
- [x] WebSockets / notifications module
- [x] Stripe payments module
- [x] Audit logging system
- [x] File upload support (@fastify/multipart)
- [x] API key authentication system
- [x] Redis integration (ioredis global module)
- [x] BullMQ email queue (emails off the request path)
- [x] Session management (list / revoke active sessions)
- [x] Account lockout after 5 failed login attempts (Redis-backed, fails open)
- [x] Prometheus metrics endpoint (/metrics) via @willsoto/nestjs-prometheus
- [x] Auth flow E2E tests (register → login → sessions → lockout → logout)
- [x] Todo CRUD E2E tests with auth

## Backlog

### Auth & Security
- [x] IP-based rate limit per endpoint (IpThrottlerGuard — tracks by req.ip)
- [x] PKCE flow for OAuth (pkce/authorize → pkce/token, S256 challenge, Redis-backed state)

### Performance & Infrastructure
- [x] OpenTelemetry tracing setup (tracing.ts — OTEL_ENABLED env var, OTLP HTTP exporter)
- [x] Request ID middleware (x-request-id / x-correlation-id passthrough via RequestContextInterceptor)
- [x] Response compression (fastify/compress with global:true — brotli → gzip → deflate)

### Developer Experience
- [x] Pre-commit hooks (husky + lint-staged)
- [x] Conventional commits enforcement (commitlint)
- [x] API versioning v2 example (TodosV2Controller at /api/v2/todos with cursor pagination)
- [x] Database query logging in development (drizzle logger: true when NODE_ENV=development)
- [x] OpenAPI schema export to JSON file (bun run openapi:codegen)
- [x] Postman / Bruno collection export (bruno/ directory)

### Testing
- [x] Contract testing with zod schema validation (src/common/contracts/ — 17 tests covering API envelope, todos, auth)
- [x] Load testing setup (k6 scripts in load-tests/ — auth + todos, smoke/load/spike)
- [ ] Mutation testing setup

### Modules to Add
- [x] Notifications module (in-app via WebSocket + email via BullMQ — NotificationsService.notifyUser() accepts email option)
- [x] File upload module (S3 / R2 compatible via STORAGE_DRIVER=s3)
- [x] Billing module (Stripe) — B2B variant (org_subscriptions table with seats, wired to Stripe)
- [x] Organizations / Teams module — B2B variant (CRUD, roles, soft delete)
- [x] Invitations module — B2B variant (email invite, 7-day token, accept/revoke)
- [x] Webhooks outbound module (BullMQ delivery + HMAC signing)
- [x] Admin dashboard module (AdminJS + @adminjs/fastify + @adminjs/sql — ADMIN_COOKIE_SECRET env var)

### Frontend Integration
- [x] Serve react-rsbuild build from NestJS static files (@fastify/static, SERVE_FRONTEND=true)
- [x] Configure CORS for frontend dev server (CORS_ORIGINS env var, comma-separated origins)
- [x] Generate TypeScript types from Drizzle schema (drizzle-zod — src/database/schema/zod.ts)
- [x] Generate API client from OpenAPI spec (openapi-typescript — bun run openapi:codegen)
- [ ] BFF (Backend for Frontend) endpoints if needed

### Observability
- [x] Structured JSON logging (Fastify/pino — LOG_LEVEL + LOG_FORMAT=json env vars; pino-pretty in dev)
- [x] Error tracking (Sentry integration — SENTRY_DSN env var)
- [ ] Uptime monitoring setup
- [ ] Database query performance tracking
