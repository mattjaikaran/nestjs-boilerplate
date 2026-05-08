import { z } from 'zod';

// ─── Base API envelope ────────────────────────────────────────────────────────

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().datetime(),
    correlationId: z.string().uuid().optional(),
  });

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  errorCode: z.string(),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.string(),
  message: z.union([z.string(), z.array(z.string()), z.unknown()]),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
