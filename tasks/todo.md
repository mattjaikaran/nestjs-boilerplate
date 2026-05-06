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
- [ ] IP-based rate limit per endpoint
- [ ] PKCE flow for OAuth (recommended for SPAs)

### Performance & Infrastructure
- [ ] OpenTelemetry tracing setup
- [ ] Request ID middleware (trace header passthrough)
- [ ] Response compression (fastify/compress wired, needs enabling)

### Developer Experience
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Conventional commits enforcement (commitlint)
- [ ] API versioning v2 example
- [ ] Database query logging in development
- [ ] OpenAPI schema export to JSON file
- [ ] Postman / Bruno collection export

### Testing
- [ ] Contract testing with zod schema validation
- [ ] Load testing setup (k6 or autocannon)
- [ ] Mutation testing setup

### Modules to Add
- [ ] Notifications module (in-app + email + push)
- [ ] File upload module (S3 / R2 compatible)
- [ ] Billing module (Stripe) — B2B variant
- [ ] Organizations / Teams module — B2B variant
- [ ] Invitations module — B2B variant
- [ ] Webhooks outbound module
- [ ] Admin dashboard module

### Frontend Integration
- [ ] Serve react-rsbuild build from NestJS static files
- [ ] Configure CORS for frontend dev server
- [ ] Generate TypeScript types from Drizzle schema (drizzle-zod)
- [ ] Generate API client from OpenAPI spec (openapi-typescript)
- [ ] BFF (Backend for Frontend) endpoints if needed

### Observability
- [ ] Structured JSON logging (pino via Fastify is already included)
- [ ] Error tracking (Sentry integration)
- [ ] Uptime monitoring setup
- [ ] Database query performance tracking
