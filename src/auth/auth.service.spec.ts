import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { DRIZZLE } from '../database/drizzle.module';
import type { User } from '../database/schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

const mockUser: User = {
  id: 'user-id-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashed-password',
  role: 'user',
  provider: 'local',
  providerId: null,
  avatarUrl: null,
  isEmailVerified: false,
  isActive: true,
  isTotpEnabled: false,
  totpSecret: null,
  webauthnCredentials: null,
  lastLoginAt: null,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const mockTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: mockUser.id, email: mockUser.email },
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let tokenService: jest.Mocked<TokenService>;
  let otpService: jest.Mocked<OtpService>;
  let totpService: jest.Mocked<TotpService>;
  let mockDb: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateLastLogin: jest.fn(),
            findByProviderId: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn(),
            revokeToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: OtpService,
          useValue: {
            createAndSendOtp: jest.fn(),
            validateByToken: jest.fn(),
            markUsed: jest.fn(),
          },
        },
        {
          provide: TotpService,
          useValue: {
            verify: jest.fn(),
            generateSetup: jest.fn(),
            enable: jest.fn(),
            disable: jest.fn(),
          },
        },
        { provide: DRIZZLE, useValue: mockDb },
        {
          provide: LockoutService,
          useValue: {
            checkLocked: jest.fn(),
            recordFailure: jest.fn(),
            clearFailures: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    tokenService = module.get(TokenService);
    otpService = module.get(OtpService);
    totpService = module.get(TotpService);
  });

  describe('register', () => {
    it('creates user and returns tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      otpService.createAndSendOtp.mockResolvedValue({} as never);
      tokenService.generateTokens.mockResolvedValue(mockTokens as never);
      jest.spyOn(argon2, 'hash').mockResolvedValue('hashed' as never);

      const result = await service.register({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'password',
      });

      expect(result).toEqual(mockTokens);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', firstName: 'Test' }),
      );
      expect(otpService.createAndSendOtp).toHaveBeenCalledWith(mockUser, 'email_verification');
    });

    it('throws ConflictException if email already registered', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      await expect(
        service.register({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'password',
        }),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('validateLocalUser', () => {
    it('returns user for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      const result = await service.validateLocalUser('test@example.com', 'password');
      expect(result).toEqual(mockUser);
    });

    it('returns null for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);
      const result = await service.validateLocalUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.validateLocalUser('unknown@example.com', 'password');
      expect(result).toBeNull();
    });

    it('returns null when user has no password (OAuth user)', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, password: null });
      const result = await service.validateLocalUser('test@example.com', 'password');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns tokens for active user without TOTP', async () => {
      tokenService.generateTokens.mockResolvedValue(mockTokens as never);
      usersService.updateLastLogin.mockResolvedValue(undefined);

      const result = await service.login(mockUser);

      expect(result).toEqual(mockTokens);
      expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      await expect(service.login({ ...mockUser, isActive: false })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('returns requiresTOTP when TOTP is enabled', async () => {
      const result = await service.login({ ...mockUser, isTotpEnabled: true });
      expect(result).toEqual({ requiresTOTP: true, userId: mockUser.id });
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('loginWithTotp', () => {
    it('returns tokens when TOTP is valid', async () => {
      usersService.findById.mockResolvedValue({ ...mockUser, isTotpEnabled: true });
      totpService.verify.mockReturnValue(true);
      usersService.updateLastLogin.mockResolvedValue(undefined);
      tokenService.generateTokens.mockResolvedValue(mockTokens as never);

      const result = await service.loginWithTotp(mockUser.id, '123456');
      expect(result).toEqual(mockTokens);
    });

    it('throws UnauthorizedException for invalid TOTP', async () => {
      usersService.findById.mockResolvedValue({ ...mockUser, isTotpEnabled: true });
      totpService.verify.mockReturnValue(false);

      await expect(service.loginWithTotp(mockUser.id, 'bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.loginWithTotp('bad-id', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes specific refresh token', async () => {
      tokenService.revokeToken.mockResolvedValue(undefined);
      await service.logout(mockUser.id, 'some-refresh-token');
      expect(tokenService.revokeToken).toHaveBeenCalledWith('some-refresh-token');
      expect(tokenService.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('revokes all tokens when no specific token provided', async () => {
      tokenService.revokeAllUserTokens.mockResolvedValue(undefined);
      await service.logout(mockUser.id);
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
      expect(tokenService.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('sends OTP for existing user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      otpService.createAndSendOtp.mockResolvedValue({} as never);

      await service.requestPasswordReset('test@example.com');

      expect(otpService.createAndSendOtp).toHaveBeenCalledWith(mockUser, 'password_reset');
    });

    it('does nothing for unknown email (prevents enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await service.requestPasswordReset('nobody@example.com');
      expect(otpService.createAndSendOtp).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password and revokes tokens', async () => {
      const mockOtp = { id: 'otp-id', userId: mockUser.id } as never;
      otpService.validateByToken.mockResolvedValue(mockOtp);
      usersService.update.mockResolvedValue(mockUser);
      otpService.markUsed.mockResolvedValue(undefined);
      tokenService.revokeAllUserTokens.mockResolvedValue(undefined);
      jest.spyOn(argon2, 'hash').mockResolvedValue('new-hashed' as never);

      await service.resetPassword('valid-token', 'new-password');

      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ password: 'new-hashed' }),
      );
      expect(otpService.markUsed).toHaveBeenCalledWith('otp-id');
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyEmail', () => {
    it('marks email as verified', async () => {
      const mockOtp = { id: 'otp-id', userId: mockUser.id } as never;
      otpService.validateByToken.mockResolvedValue(mockOtp);
      usersService.update.mockResolvedValue(mockUser);
      otpService.markUsed.mockResolvedValue(undefined);

      await service.verifyEmail('valid-token');

      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, { isEmailVerified: true });
      expect(otpService.markUsed).toHaveBeenCalledWith('otp-id');
    });
  });

  describe('validateOAuthUser', () => {
    const oauthData = {
      provider: 'google',
      providerId: 'google-123',
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('returns existing user by provider ID', async () => {
      usersService.findByProviderId.mockResolvedValue(mockUser);
      const result = await service.validateOAuthUser(oauthData);
      expect(result).toEqual(mockUser);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('links OAuth to existing email account', async () => {
      const updatedUser = { ...mockUser, provider: 'google' as never };
      usersService.findByProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.update.mockResolvedValue(updatedUser);

      const result = await service.validateOAuthUser(oauthData);
      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ provider: 'google', isEmailVerified: true }),
      );
    });

    it('creates new user for new OAuth account', async () => {
      usersService.findByProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.validateOAuthUser(oauthData);
      expect(result).toEqual(mockUser);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'oauth@example.com', isEmailVerified: true }),
      );
    });
  });
});
