import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { EMAIL_JOBS, EMAIL_QUEUE } from './queue.constants';

export interface SendVerificationJobData {
  to: string;
  code: string;
  token: string;
}

export interface SendPasswordResetJobData {
  to: string;
  code: string;
  token: string;
}

export interface SendMagicLinkJobData {
  to: string;
  token: string;
}

export interface SendGenericJobData {
  to: string;
  subject: string;
  html: string;
}

export interface SendNotificationJobData {
  to: string;
  title: string;
  message: string;
  actionUrl?: string;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFICATION: {
        const { to, code, token } = job.data as SendVerificationJobData;
        await this.emailService.sendEmailVerification(to, code, token);
        break;
      }
      case EMAIL_JOBS.SEND_PASSWORD_RESET: {
        const { to, code, token } = job.data as SendPasswordResetJobData;
        await this.emailService.sendPasswordReset(to, code, token);
        break;
      }
      case EMAIL_JOBS.SEND_MAGIC_LINK: {
        const { to, token } = job.data as SendMagicLinkJobData;
        await this.emailService.sendMagicLink(to, token);
        break;
      }
      case EMAIL_JOBS.SEND_GENERIC: {
        const { to, subject, html } = job.data as SendGenericJobData;
        await this.emailService.send({ to, subject, html });
        break;
      }
      case EMAIL_JOBS.SEND_NOTIFICATION: {
        const { to, title, message, actionUrl } = job.data as SendNotificationJobData;
        await this.emailService.sendNotification(to, title, message, actionUrl);
        break;
      }
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }
}
