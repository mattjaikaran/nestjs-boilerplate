import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type OTP, type User, otps } from '../database/schema';

export type OtpType = OTP['type'];

@Injectable()
export class OtpService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async createAndSendOtp(user: User, type: OtpType): Promise<OTP> {
    // Invalidate existing unused OTPs of the same type
    await this.db
      .update(otps)
      .set({ isUsed: true })
      .where(and(eq(otps.userId, user.id), eq(otps.type, type), eq(otps.isUsed, false)));

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const [otp] = await this.db
      .insert(otps)
      .values({ code, token, type, userId: user.id, expiresAt })
      .returning();

    // TODO: wire to email provider (Resend / SendGrid / SMTP)
    // In production: await emailService.send({ to: user.email, template: type, data: { code, token } })
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP:${type}] email=${user.email} code=${code} token=${token}`);
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

    if (!otp) throw new BadRequestException('Invalid or expired token');
    return otp;
  }

  async markUsed(id: string): Promise<void> {
    await this.db.update(otps).set({ isUsed: true }).where(eq(otps.id, id));
  }
}
