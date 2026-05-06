import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import { and, eq, gt } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  UserEmailVerifiedEvent,
  UserLoginEvent,
  UserPasswordResetEvent,
  UserRegisteredEvent,
} from '../common/events/user.events';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type User, refreshTokens } from '../database/schema';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import { LockoutService } from './lockout.service';
import { OtpService, type OtpType } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

export type LoginResult = AuthTokens | { requiresTOTP: true; userId: string };

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
    private totpService: TotpService,
    private lockoutService: LockoutService,
    private eventEmitter: EventEmitter2,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  async register(
    dto: RegisterDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing)
      throw new AppException(
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
        'Email already registered',
        HttpStatus.CONFLICT,
      );

    const hashedPassword = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: hashedPassword,
      provider: 'local',
    });

    await this.otpService.createAndSendOtp(user, 'email_verification');
    this.eventEmitter.emit('user.registered', new UserRegisteredEvent(user));

    return this.tokenService.generateTokens(user, meta);
  }

  async validateLocalUser(email: string, password: string): Promise<User | null> {
    await this.lockoutService.checkLocked(email);
    const user = await this.usersService.findByEmail(email);
    if (!user?.password) {
      await this.lockoutService.recordFailure(email);
      return null;
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      await this.lockoutService.recordFailure(email);
      return null;
    }
    await this.lockoutService.clearFailures(email);
    return user;
  }

  async login(user: User, meta?: { ipAddress?: string; userAgent?: string }): Promise<LoginResult> {
    if (!user.isActive)
      throw new AppException(
        ErrorCode.AUTH_ACCOUNT_DISABLED,
        'Account disabled',
        HttpStatus.UNAUTHORIZED,
      );

    if (user.isTotpEnabled) {
      return { requiresTOTP: true, userId: user.id };
    }

    await this.usersService.updateLastLogin(user.id);
    this.eventEmitter.emit('user.login', new UserLoginEvent(user.id, meta?.ipAddress));
    return this.tokenService.generateTokens(user, meta);
  }

  async loginWithTotp(
    userId: string,
    totpToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive)
      throw new AppException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

    const valid = this.totpService.verify(user, totpToken);
    if (!valid)
      throw new AppException(
        ErrorCode.AUTH_TOTP_INVALID,
        'Invalid TOTP token',
        HttpStatus.UNAUTHORIZED,
      );

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

    if (!tokenRecord)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );

    const user = await this.usersService.findById(tokenRecord.userId);
    if (!user || !user.isActive)
      throw new AppException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

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
    this.eventEmitter.emit('user.password_reset', new UserPasswordResetEvent(otp.userId));
  }

  async verifyEmail(token: string): Promise<void> {
    const otp = await this.otpService.validateByToken(token, 'email_verification');
    await this.usersService.update(otp.userId, { isEmailVerified: true });
    await this.otpService.markUsed(otp.id);
    this.eventEmitter.emit('user.email_verified', new UserEmailVerifiedEvent(otp.userId));
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
    if (!user)
      throw new AppException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    await this.otpService.markUsed(otp.id);
    if (!user.isEmailVerified) {
      await this.usersService.update(user.id, { isEmailVerified: true });
    }
    return this.tokenService.generateTokens(user, meta);
  }
}
