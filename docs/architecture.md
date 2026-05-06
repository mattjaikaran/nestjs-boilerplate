# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Fastify HTTP                        │
│  helmet (CSP/XSS) · compress (brotli/gzip) · CORS       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Global Interceptors                     │
│  RequestContext → Logging → ResponseTransform → Timeout  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Global Guards                          │
│  Throttler → JwtAuth → ApiKey → Roles → Permissions      │
└───────────────────────┬─────────────────────────────────┘
                        │
              ┌─────────┴──────────┐
              │                    │
    ┌─────────▼────────┐  ┌───────▼────────────┐
    │  Feature Modules  │  │  Infrastructure     │
    │  Auth / Users     │  │  DrizzleModule      │
    │  Todos (CQRS)     │  │  RedisModule        │
    │  Payments         │  │  QueueModule        │
    │  Uploads          │  │  CacheModule        │
    │  Notifications    │  │  MetricsModule      │
    │  Audit            │  │  SchedulerModule    │
    └──────────────────┘  └────────────────────┘
```

## Module Dependency Map

```
AppModule
├── ConfigModule (global)
├── EventEmitterModule (global)
├── ThrottlerModule
├── AppCacheModule → RedisModule
├── DrizzleModule
├── RedisModule
├── QueueModule → EmailModule
├── MetricsModule
├── SchedulerModule
├── AuthModule → UsersModule → DrizzleModule
├── UsersModule → DrizzleModule
├── TodosModule → CqrsModule + DrizzleModule
├── UploadsModule
├── AuditModule → DrizzleModule
├── HealthModule → TerminusModule
├── NotificationsModule
└── PaymentsModule
```

## Request Lifecycle

1. **Fastify** receives the request. `@fastify/helmet` injects security headers; `@fastify/compress` negotiates response encoding.

2. **RequestContextInterceptor** allocates an `AsyncLocalStorage` context with a new `correlationId` UUID. All downstream code — services, event handlers, queue processors — reads context from the store without prop-drilling.

3. **ThrottlerGuard** checks rate limit buckets (short: 10/s, medium: 50/10s, long: 100/60s).

4. **JwtAuthGuard** validates the `Authorization: Bearer <token>` header. Routes decorated with `@Public()` bypass this. If valid, the JWT payload is attached to `request.user`.

5. **ApiKeyGuard** — if no JWT was found, checks the `x-api-key` header. Looks up the key hash in the `api_keys` table and populates `request.user` from the associated user row.

6. **RolesGuard** reads the `@Roles()` metadata and compares against `request.user.role`.

7. **PermissionsGuard** reads `@Permissions()` metadata and checks `request.user.permissions`.

8. **Controller** receives the validated, transformed DTO (via `ValidationPipe`). Dispatches to the service or, for CQRS modules, to the `CommandBus` / `QueryBus`.

9. **Service / Handler** performs business logic, interacts with Drizzle ORM, emits domain events, queues background jobs, or reads from cache.

10. **ResponseTransformInterceptor** wraps the return value: `{ success: true, data: <result>, correlationId, timestamp }`.

11. **LoggingInterceptor** logs method, path, status code, duration, and correlationId.

12. The `x-correlation-id` response header echoes the correlation ID for client-side tracing.

## Database

**Drizzle ORM** with `postgres.js` driver. Schema files in `src/database/schema/`:

| File | Tables |
|------|--------|
| `users.schema.ts` | `users` |
| `auth.schema.ts` | `refresh_tokens`, `otps`, `webauthn_credentials`, `magic_links`, `sessions` |
| `api-keys.schema.ts` | `api_keys` |
| `todos.schema.ts` | `todos` |
| `audit.schema.ts` | `audit_logs` |
| `payments.schema.ts` | `payments` |

Run migrations with Drizzle Kit:
```bash
bun run db:generate   # generate migration SQL
bun run db:migrate    # apply migrations
bun run db:push       # push schema directly (dev only)
bun run db:studio     # open Drizzle Studio UI
```

## Event Bus

`EventEmitter2` with wildcard routing. Events are emitted synchronously but listeners run asynchronously (fire-and-forget by default). `DomainEventListener` is the central async handler; add side effects there rather than in-line in services to keep the write path fast.

## Background Jobs

BullMQ processes jobs in a separate event loop turn. Each job has a Redis-backed queue, retry policy (3 attempts, exponential backoff), and result retention (100 completed / 500 failed). The `EmailProcessor` handles `email` queue jobs by calling the Resend API via `EmailService`.

## Graceful Shutdown

`app.enableShutdownHooks()` is registered at bootstrap. NestJS listens for `SIGTERM` / `SIGINT` and calls `onModuleDestroy()` on every provider before the process exits, allowing in-flight requests to finish and queue workers to drain.
