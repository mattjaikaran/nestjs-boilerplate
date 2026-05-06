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

## In Progress
- [ ] Email service integration (Resend / SendGrid / Nodemailer)
  - OtpService has TODO comments ready for wiring
- [ ] TOTP / Authenticator app (otplib is installed, wiring needed)
  - See src/auth/ — totpSecret on user schema is ready

## Backlog

### Auth & Security
- [ ] Email service provider integration (Resend recommended)
- [ ] TOTP / authenticator app (otplib already installed)
- [ ] Session management endpoint (list / revoke active sessions)
- [ ] Account lockout after N failed login attempts (needs Redis)
- [ ] IP-based rate limit per endpoint
- [ ] PKCE flow for OAuth (recommended for SPAs)
- [ ] Audit log table for auth events

### Performance & Infrastructure
- [ ] Redis integration for caching + rate limit store
- [ ] Bull/BullMQ queue for background jobs (email sending, etc.)
- [ ] Prometheus metrics endpoint (/metrics)
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
- [ ] Seed E2E test database fixture
- [ ] Auth flow E2E tests (register → verify → login → refresh → logout)
- [ ] Todo CRUD E2E tests with auth
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
