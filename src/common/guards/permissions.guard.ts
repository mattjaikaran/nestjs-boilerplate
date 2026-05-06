import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '../decorators/permissions.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { UserRole } from '../decorators/roles.decorator';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'users:read',
    'users:write',
    'users:delete',
    'todos:read',
    'todos:write',
    'todos:delete',
    'admin:access',
    'admin:users',
    'admin:audit',
    'payments:read',
    'payments:write',
  ],
  moderator: ['users:read', 'todos:read', 'todos:write', 'todos:delete', 'payments:read'],
  user: ['todos:read', 'todos:write', 'todos:delete', 'payments:read'],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const granted = ROLE_PERMISSIONS[user.role as UserRole] ?? [];
    return required.every((p) => granted.includes(p));
  }
}
