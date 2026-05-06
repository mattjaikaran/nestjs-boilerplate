import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'moderator']);
export const authProviderEnum = pgEnum('auth_provider', ['local', 'google', 'github']);
export const otpTypeEnum = pgEnum('otp_type', [
  'email_verification',
  'password_reset',
  'magic_link',
  'two_factor',
]);
export const todoStatusEnum = pgEnum('todo_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);
export const todoPriorityEnum = pgEnum('todo_priority', ['low', 'medium', 'high']);
export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member', 'viewer']);
