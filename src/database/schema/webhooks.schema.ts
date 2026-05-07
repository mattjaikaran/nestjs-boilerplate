import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // HMAC signing secret (stored hashed)
  description: varchar('description', { length: 255 }),
  events: jsonb('events').notNull().$type<string[]>(), // ['user.registered', '*']
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  endpointId: uuid('endpoint_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | success | failed
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attemptCount: integer('attempt_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
