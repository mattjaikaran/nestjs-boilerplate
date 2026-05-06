import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type User, refreshTokens } from '../database/schema';
import type { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import type { OtpService, OtpType } from './otp.service';
import type { TokenService } from './token.service';

export interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private otpService: OtpService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  async register(
    dto: RegisterDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: hashedPassword,
      provider: 'local',
    });

    await this.otpService.createAndSendOtp(user, 'email_verification');

    return this.tokenService.generateTokens(user, meta);
  }

  async validateLocalUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user?.password) return null;
    const valid = await argon2.verify(user.password, password);
    return valid ? user : null;
  }

  async login(user: User, meta?: { ipAddress?: string; userAgent?: string }): Promise<AuthTokens> {
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    await this.usersService.updateLastLogin(user.id);
    return this.tokenService.generateTokens(user, meta);
  }

  async refreshTokens(
    refreshTokenValue: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const [tokenRecord] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshTokenValue),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!tokenRecord) throw new UnauthorizedException('Invalid or expired refresh token');

    const user = await this.usersService.findById(tokenRecord.userId);
    if (!user || !user.isActive) throw new UnauthorizedException();

    await this.tokenService.revokeToken(refreshTokenValue);

    return this.tokenService.generateTokens(user, meta);
  }

  async logout(userId: string, refreshTokenValue?: string): Promise<void> {
    if (refreshTokenValue) {
      await this.tokenService.revokeToken(refreshTokenValue);
    } else {
      await this.tokenService.revokeAllUserTokens(userId);
    }
  }

  async validateOAuthUser(data: OAuthUserData): Promise<User> {
    let user = await this.usersService.findByProviderId(data.provider, data.providerId);

    if (!user) {
      const byEmail = await this.usersService.findByEmail(data.email);
      if (byEmail) {
        return this.usersService.update(byEmail.id, {
          provider: data.provider as User['provider'],
          providerId: data.providerId,
          avatarUrl: data.avatarUrl,
          isEmailVerified: true,
        });
      }
      user = await this.usersService.create({
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        provider: data.provider as User['provider'],
        providerId: data.providerId,
        avatarUrl: data.avatarUrl,
        isEmailVerified: true,
        password: null,
      });
    }

    return user;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // no email enumeration
    await this.otpService.createAndSendOtp(user, 'password_reset');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const otp = await this.otpService.validateByToken(token, 'password_reset');
    const hashedPassword = await argon2.hash(newPassword);
    await this.usersService.update(otp.userId, { password: hashedPassword });
    await this.otpService.markUsed(otp.id);
    await this.tokenService.revokeAllUserTokens(otp.userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const otp = await this.otpService.validateByToken(token, 'email_verification');
    await this.usersService.update(otp.userId, { isEmailVerified: true });
    await this.otpService.markUsed(otp.id);
  }

  async sendMagicLink(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;
    await this.otpService.createAndSendOtp(user, 'magic_link');
  }

  async validateMagicLink(
    token: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const otp = await this.otpService.validateByToken(token, 'magic_link');
    const user = await this.usersService.findById(otp.userId);
    if (!user) throw new UnauthorizedException();
    await this.otpService.markUsed(otp.id);
    if (!user.isEmailVerified) {
      await this.usersService.update(user.id, { isEmailVerified: true });
    }
    return this.tokenService.generateTokens(user, meta);
  }
}
