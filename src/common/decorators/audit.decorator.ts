import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '../../database/schema';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: AuditAction;
  resource: string;
}

export const Audit = (action: AuditAction, resource: string) =>
  SetMetadata(AUDIT_KEY, { action, resource } satisfies AuditMetadata);
