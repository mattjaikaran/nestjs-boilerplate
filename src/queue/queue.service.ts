import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMAIL_JOBS, EMAIL_QUEUE } from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private emailQueue: Queue) {}

  async sendVerificationEmail(to: string, code: string, token: string): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_VERIFICATION, { to, code, token });
    this.logger.debug(`Queued verification email to ${to}`);
  }

  async sendPasswordResetEmail(to: string, code: string, token: string): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_PASSWORD_RESET, { to, code, token });
    this.logger.debug(`Queued password reset email to ${to}`);
  }

  async sendMagicLinkEmail(to: string, token: string): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_MAGIC_LINK, { to, token });
    this.logger.debug(`Queued magic link email to ${to}`);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.SEND_GENERIC, { to, subject, html });
    this.logger.debug(`Queued generic email to ${to}: ${subject}`);
  }
}
