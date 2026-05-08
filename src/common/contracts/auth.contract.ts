import { z } from 'zod';
import { apiSuccessSchema } from './api-response.contract';

// ─── Auth response contracts ──────────────────────────────────────────────────

export const userPublicContract = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  role: z.enum(['admin', 'user', 'moderator']),
  isEmailVerified: z.boolean(),
  createdAt: z.string(),
});

export const authTokensContract = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: userPublicContract,
});

export const registerResponseSchema = apiSuccessSchema(authTokensContract);
export const loginResponseSchema = apiSuccessSchema(authTokensContract);
export const refreshResponseSchema = apiSuccessSchema(z.object({ accessToken: z.string().min(1) }));

export type UserPublicContract = z.infer<typeof userPublicContract>;
export type AuthTokensContract = z.infer<typeof authTokensContract>;
