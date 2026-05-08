# Feature Reference

Covers every cross-cutting feature beyond auth. For auth specifics see [auth.md](auth.md).

---

## Todos API

The todo endpoints are designed to be compatible with the companion frontend boilerplates (`react-vite-boilerplate`, `react-rsbuild-boilerplate`). Both use the same API contract.

### Response shape

All todo responses include both the DB field and a frontend-friendly alias:
```json
{ "isCompleted": true, "completed": true, ... }
```

### Filtering (`GET /api/v1/todos`)

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Title substring match |
| `priority` | `low` \| `medium` \| `high` | Filter by priority |
| `completed` | boolean | Filter by completion status |
| `overdue` | boolean | Todos with past `dueDate` and not completed |
| `due_today` | boolean | Todos with `dueDate` within today |
| `page` / `limit` | number | Pagination |
| `sortBy` / `sortOrder` | string / ASC\|DESC | Ordering |

### Bulk operations

- `PATCH /bulk` — accepts `{ ids, ...updates }` (rsbuild) or `{ ids, updates }` (react-vite)
- `POST /bulk-delete` or `DELETE /bulk` — soft-delete multiple todos
- `POST /archive-completed` — soft-delete all completed todos

### Toggle endpoints

Both `POST /:id/toggle` (rsbuild) and `PATCH /:id/toggle` (react-vite) are supported.

---

## CQRS

Enabled via `@nestjs/cqrs`. The `TodosModule` is the canonical example.

### Structure
```
todos/
├── commands/   CreateTodoCommand, UpdateTodoCommand, DeleteTodoCommand
├── queries/    GetTodoQuery, ListTodosQuery
└── handlers/   One handler per command/query
```

### Dispatching
```typescript
// Command (mutates state)
await this.commandBus.execute(new CreateTodoCommand(userId, dto));

// Query (read-only)
return this.queryBus.execute(new GetTodoQuery(userId, id));
```

### Adding CQRS to a new module
1. Add `CqrsModule` to the module's `imports`
2. Register handlers in `providers`
3. Inject `CommandBus` / `QueryBus` in the controller

---

## Domain Events

Powered by `@nestjs/event-emitter` with wildcard support.

### Built-in events

| Event name | Payload class | Emitted when |
|------------|---------------|--------------|
| `user.registered` | `UserRegisteredEvent` | Registration succeeds |
| `user.login` | `UserLoginEvent` | Login succeeds |
| `user.email_verified` | `UserEmailVerifiedEvent` | Email OTP verified |
| `user.password_reset` | `UserPasswordResetEvent` | Password reset completes |
| `todo.created` | `TodoCreatedEvent` | Todo created |
| `todo.updated` | `TodoUpdatedEvent` | Todo updated |
| `todo.deleted` | `TodoDeletedEvent` | Todo soft-deleted |

### Emitting an event
```typescript
this.eventEmitter.emit('user.registered', new UserRegisteredEvent(user));
```

### Listening
Add a method to `DomainEventListener` (or create a new listener):
```typescript
@OnEvent('user.*')
handleUserEvent(event: DomainEventBase) {
  // runs for any user.* event
}
```

The central `DomainEventListener` logs all events. Add side effects (send welcome email, etc.) there or in dedicated listeners.

---

## Request Context

`AsyncLocalStorage`-based correlation tracking. Survives async boundaries without prop-drilling.

### What it provides
- `correlationId` — UUID generated per request, echoed in the `x-correlation-id` response header
- `userId` — populated from JWT payload after auth
- Included in every log line and in the response envelope `{ ..., correlationId }`

### Accessing in a service
```typescript
import { RequestContext } from '@/common/context/request-context';

const ctx = RequestContext.get();
console.log(ctx.correlationId, ctx.userId);
```

---

## Cache

Redis-backed `@nestjs/cache-manager` via `cache-manager-ioredis-yet`. Falls back to in-memory if Redis is unavailable.

### Using the cache
```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

// Set with TTL (seconds)
await this.cache.set('key', value, 300);

// Get
const value = await this.cache.get<MyType>('key');

// Delete
await this.cache.del('key');
```

### Cache-aside pattern with `@CacheKey` / `@CacheTTL`
```typescript
@Get(':id')
@CacheKey('todo')
@CacheTTL(60)
async getTodo(@Param('id') id: string) { ... }
```

### Config
```env
REDIS_URL=redis://localhost:6379
```

---

## Background Queue

BullMQ + Redis. The `email` queue is pre-wired. Adding more queues:

1. Add a constant to `queue.constants.ts`
2. Register in `QueueModule` via `BullModule.registerQueue`
3. Create a processor with `@Processor(QUEUE_NAME)`

### Enqueueing a job
```typescript
constructor(private queueService: QueueService) {}

await this.queueService.enqueueEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<p>Hello</p>',
});
```

### Job options (defaults)
- 3 retry attempts with exponential backoff (2s base)
- Keep last 100 completed jobs, last 500 failed jobs

### Monitoring
- Bull Board UI can be added via `@bull-board/nestjs` if needed
- Prometheus counter `queue_job_total{queue, job, status}` tracks processed jobs

---

## Scheduler

`@nestjs/schedule` cron jobs in `SchedulerModule`.

| Job | Schedule | Action |
|-----|----------|--------|
| `purgeExpiredTokens` | 2 AM daily | Delete revoked/expired refresh tokens older than 7 days |
| `purgeExpiredOtps` | Every hour | Delete expired OTP records |
| `archiveOldTodos` | Sunday midnight | Archive todos completed > 30 days ago |
| Liveness tick | Every 5 minutes | Logs a heartbeat (useful for health monitoring) |

### Adding a cron job
```typescript
@Cron('0 3 * * *')
async myJob() {
  this.logger.log('running my job');
}
```

---

## WebSockets

Socket.io gateway in `NotificationsModule` with JWT authentication.

### Connect (client)
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' },
});

socket.on('notification', (data) => console.log(data));
```

### Send from server
```typescript
constructor(private notificationsService: NotificationsService) {}

// Push to a specific user
this.notificationsService.sendToUser(userId, 'notification', payload);

// Broadcast to all connected clients
this.notificationsService.broadcast('system', payload);
```

### Auth
The `WsJwtGuard` validates the `auth.token` field on the initial handshake and populates the socket's `data.user`.

---

## Prometheus Metrics

Endpoint: `GET /metrics` (Prometheus scrape format)

### Built-in metrics

| Metric | Type | Labels |
|--------|------|--------|
| `auth_login_total` | Counter | `status`, `method` |
| `auth_register_total` | Counter | `status` |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `queue_job_total` | Counter | `queue`, `job`, `status` |
| Node.js default metrics | Various | — |

### Adding a metric
```typescript
// In your module's providers:
makeCounterProvider({ name: 'my_counter', help: '...', labelNames: ['label'] })

// In your service:
@InjectMetric('my_counter') private counter: Counter<string>

this.counter.inc({ label: 'value' });
```

### Grafana
A standard NestJS dashboard (ID 14565) works out of the box with the default metrics.

---

## Abstract CRUD Base

`AbstractCrudService<Entity, CreateDto, UpdateDto>` and `AbstractCrudController<T>` in `src/common/base/`.

Extend them for any resource to get `create`, `findAll`, `findOne`, `update`, `remove` with minimal boilerplate:

```typescript
@Injectable()
export class WidgetsService extends AbstractCrudService<Widget, CreateWidgetDto, UpdateWidgetDto> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, widgets);
  }
}
```

---

## Audit Logging

Every mutating request (POST, PUT, PATCH, DELETE) is logged to the `audit_logs` table via `AuditInterceptor` and the `@Audit()` decorator.

Log entries include: `userId`, `action`, `resource`, `resourceId`, `ipAddress`, `userAgent`, `before`, `after`, `timestamp`.

### Read audit logs (admin only)
```
GET /api/v1/audit?userId=...&resource=...&page=1&limit=20
```
