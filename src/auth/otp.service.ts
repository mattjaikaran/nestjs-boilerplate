import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type OTP, type User, otps } from '../database/schema';
import { QueueService } from '../queue/queue.service';

export type OtpType = OTP['type'];

@Injectable()
export class OtpService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private queueService: QueueService,
  ) {}

  async createAndSendOtp(user: User, type: OtpType): Promise<OTP> {
    await this.db
      .update(otps)
      .set({ isUsed: true })
      .where(and(eq(otps.userId, user.id), eq(otps.type, type), eq(otps.isUsed, false)));

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const [otp] = await this.db
      .insert(otps)
      .values({ code, token, type, userId: user.id, expiresAt })
      .returning();

    switch (type) {
      case 'email_verification':
        await this.queueService.sendVerificationEmail(user.email, code, token);
        break;
      case 'password_reset':
        await this.queueService.sendPasswordResetEmail(user.email, code, token);
        break;
      case 'magic_link':
        await this.queueService.sendMagicLinkEmail(user.email, token);
        break;
    }

    return otp;
  }

  async validateByToken(token: string, type: OtpType): Promise<OTP> {
    const [otp] = await this.db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.token, token),
          eq(otps.type, type),
          eq(otps.isUsed, false),
          gt(otps.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!otp)
      throw new AppException(
        ErrorCode.AUTH_OTP_INVALID,
        'Invalid or expired token',
        HttpStatus.BAD_REQUEST,
      );
    return otp;
  }

  async markUsed(id: string): Promise<void> {
    await this.db.update(otps).set({ isUsed: true }).where(eq(otps.id, id));
  }
}
