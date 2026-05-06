import { SetMetadata } from '@nestjs/common';

export type Permission =
  // User permissions
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  // Todo permissions
  | 'todos:read'
  | 'todos:write'
  | 'todos:delete'
  // Admin permissions
  | 'admin:access'
  | 'admin:users'
  | 'admin:audit'
  // Payment permissions
  | 'payments:read'
  | 'payments:write';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
