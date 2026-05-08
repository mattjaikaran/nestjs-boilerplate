import { z } from 'zod';
import { apiSuccessSchema } from './api-response.contract';

// ─── Todo response contract ───────────────────────────────────────────────────

export const todoContract = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high']),
  isCompleted: z.boolean(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  userId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
});

export const todoListContract = z.object({
  items: z.array(todoContract),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export const todoResponseSchema = apiSuccessSchema(todoContract);
export const todoListResponseSchema = apiSuccessSchema(todoListContract);

export type TodoContract = z.infer<typeof todoContract>;
export type TodoListContract = z.infer<typeof todoListContract>;
