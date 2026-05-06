import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type User, users } from '../database/schema';

@Injectable()
export class TotpService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async generateSetup(user: User): Promise<{ secret: string; qrCodeDataUrl: string; uri: string }> {
    if (user.isTotpEnabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    const secret = authenticator.generateSecret();
    const appName = process.env.APP_NAME || 'NestJS Boilerplate';
    const uri = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await this.db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));

    return { secret, qrCodeDataUrl, uri };
  }

  async enable(user: User, token: string): Promise<void> {
    if (user.isTotpEnabled) {
      throw new BadRequestException('TOTP is already enabled');
    }
    if (!user.totpSecret) {
      throw new BadRequestException('TOTP setup not initiated — call /auth/totp/setup first');
    }

    const valid = authenticator.verify({ token, secret: user.totpSecret });
    if (!valid) throw new BadRequestException('Invalid TOTP token');

    await this.db.update(users).set({ isTotpEnabled: true }).where(eq(users.id, user.id));
  }

  async disable(user: User, token: string): Promise<void> {
    if (!user.isTotpEnabled) {
      throw new BadRequestException('TOTP is not enabled');
    }
    if (!user.totpSecret) {
      throw new UnauthorizedException();
    }

    const valid = authenticator.verify({ token, secret: user.totpSecret });
    if (!valid) throw new BadRequestException('Invalid TOTP token');

    await this.db
      .update(users)
      .set({ isTotpEnabled: false, totpSecret: null })
      .where(eq(users.id, user.id));
  }

  verify(user: User, token: string): boolean {
    if (!user.totpSecret) return false;
    return authenticator.verify({ token, secret: user.totpSecret });
  }
}
