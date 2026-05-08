import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly from: string;
  private readonly appName: string;
  private readonly appUrl: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('email.resendApiKey');
    this.from = this.config.get<string>('email.from', 'noreply@example.com');
    this.appName = this.config.get<string>('email.appName', 'NestJS Boilerplate');
    this.appUrl = this.config.get<string>('email.appUrl', 'http://localhost:3000');

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged to console only');
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[EMAIL] to=${options.to} subject="${options.subject}"`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      throw new Error(`Email send failed: ${error.message}`);
    }
  }

  async sendEmailVerification(to: string, code: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/api/v1/auth/verify-email/${token}`;
    await this.send({
      to,
      subject: `Verify your ${this.appName} email`,
      html: `
        <h2>Verify your email</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>Or click the link below to verify automatically:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 30 minutes.</p>
      `,
    });
  }

  async sendPasswordReset(to: string, code: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: `Reset your ${this.appName} password`,
      html: `
        <h2>Reset your password</h2>
        <p>Your reset code is: <strong>${code}</strong></p>
        <p>Or click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
      `,
    });
  }

  async sendMagicLink(to: string, token: string): Promise<void> {
    const magicUrl = `${this.appUrl}/api/v1/auth/magic-link/${token}`;
    await this.send({
      to,
      subject: `Sign in to ${this.appName}`,
      html: `
        <h2>Sign in to ${this.appName}</h2>
        <p>Click the link below to sign in. This link expires in 30 minutes.</p>
        <p><a href="${magicUrl}">Sign in</a></p>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });
  }

  async sendNotification(
    to: string,
    title: string,
    message: string,
    actionUrl?: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `${title} — ${this.appName}`,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        ${actionUrl ? `<p><a href="${actionUrl}">View details</a></p>` : ''}
        <hr />
        <p style="color:#999;font-size:12px;">You received this because you have notifications enabled. Visit ${this.appUrl}/settings to manage preferences.</p>
      `,
    });
  }
}
