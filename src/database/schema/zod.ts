/**
 * Zod schemas derived from Drizzle table definitions via drizzle-zod.
 * Use these for runtime validation at API boundaries, not inside controllers
 * (class-validator handles that). Primary use cases: service-layer guards,
 * unit tests, and frontend type sharing.
 */
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { apiKeys } from './api-keys.schema';
import { auditLogs } from './audit.schema';
import { otps, refreshTokens } from './auth.schema';
import { payments, subscriptions } from './payments.schema';
import { todos } from './todos.schema';
import { users } from './users.schema';
import { webhookDeliveries, webhookEndpoints } from './webhooks.schema';

// ─── Users ───────────────────────────────────────────────────────────────────
export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);
export type UserRow = z.infer<typeof selectUserSchema>;
export type NewUserRow = z.infer<typeof insertUserSchema>;

// ─── Todos ───────────────────────────────────────────────────────────────────
export const selectTodoSchema = createSelectSchema(todos);
export const insertTodoSchema = createInsertSchema(todos);
export type TodoRow = z.infer<typeof selectTodoSchema>;
export type NewTodoRow = z.infer<typeof insertTodoSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const selectRefreshTokenSchema = createSelectSchema(refreshTokens);
export const selectOtpSchema = createSelectSchema(otps);

// ─── API Keys ────────────────────────────────────────────────────────────────
export const selectApiKeySchema = createSelectSchema(apiKeys);
export const insertApiKeySchema = createInsertSchema(apiKeys);

// ─── Payments ────────────────────────────────────────────────────────────────
export const selectPaymentSchema = createSelectSchema(payments);
export const selectSubscriptionSchema = createSelectSchema(subscriptions);

// ─── Audit ───────────────────────────────────────────────────────────────────
export const selectAuditLogSchema = createSelectSchema(auditLogs);

// ─── Webhooks ────────────────────────────────────────────────────────────────
export const selectWebhookEndpointSchema = createSelectSchema(webhookEndpoints);
export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints);
export const selectWebhookDeliverySchema = createSelectSchema(webhookDeliveries);
