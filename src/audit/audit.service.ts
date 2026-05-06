import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type AuditAction, type AuditLog, auditLogs } from '../database/schema';

export interface LogAuditEvent {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async log(event: LogAuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLogs).values(event);
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async findByUser(userId: string, limit = 50, offset = 0): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
}
