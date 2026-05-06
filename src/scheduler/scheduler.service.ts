import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval, Timeout } from '@nestjs/schedule';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { otps, refreshTokens, todos } from '../database/schema';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Purge expired refresh tokens — runs nightly at 2 AM */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'purge-refresh-tokens' })
  async purgeExpiredRefreshTokens(): Promise<void> {
    await this.db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
    this.logger.log('Purged expired refresh tokens');
  }

  /** Purge expired OTPs — runs every hour */
  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-otps' })
  async purgeExpiredOtps(): Promise<void> {
    await this.db.delete(otps).where(lt(otps.expiresAt, new Date()));
    this.logger.log('Purged expired OTPs');
  }

  /** Soft-delete completed todos older than 30 days — runs weekly on Sunday at 3 AM */
  @Cron('0 3 * * 0', { name: 'archive-old-todos' })
  async archiveOldCompletedTodos(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.db
      .update(todos)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(todos.isCompleted, true),
          isNotNull(todos.completedAt),
          lt(todos.completedAt, thirtyDaysAgo),
        ),
      );
    this.logger.log('Archived old completed todos');
  }

  /** Health tick every 5 minutes — confirms scheduler process is alive */
  @Interval(5 * 60 * 1000)
  schedulerHealthTick(): void {
    this.logger.debug('Scheduler alive');
  }

  /** One-time startup confirmation */
  @Timeout(0)
  onApplicationStart(): void {
    this.logger.log('Scheduler initialized');
  }
}
