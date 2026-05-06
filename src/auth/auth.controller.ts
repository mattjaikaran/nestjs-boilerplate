import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { User } from '../database/schema';
import { AuthService } from './auth.service';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { MagicLinkDto } from './dto/magic-link.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { TotpVerifyDto } from './dto/totp.dto';
import { TotpService } from './totp.service';
import { WebAuthnService } from './webauthn.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private totpService: TotpService,
    private webauthnService: WebAuthnService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register with email/password' })
  async register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    return this.authService.register(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('login')
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  async login(@Req() req: FastifyRequest, @CurrentUser() user: User) {
    return this.authService.login(user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req: FastifyRequest) {
    return this.authService.refreshTokens(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (revoke tokens)' })
  async logout(@CurrentUser() user: User, @Body('refreshToken') refreshToken?: string) {
    await this.authService.logout(user.id, refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  me(@CurrentUser() user: User) {
    return user;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password with OTP token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Get('verify-email/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Param('token') token: string) {
    await this.authService.verifyEmail(token);
  }

  @Public()
  @Post('magic-link')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send magic link for passwordless login' })
  async sendMagicLink(@Body() dto: MagicLinkDto) {
    await this.authService.sendMagicLink(dto.email);
  }

  @Public()
  @Get('magic-link/:token')
  @ApiOperation({ summary: 'Authenticate with magic link token' })
  async validateMagicLink(@Param('token') token: string) {
    return this.authService.validateMagicLink(token);
  }

  // OAuth - Google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth' })
  googleAuth() {
    // handled by passport
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@CurrentUser() user: User) {
    return this.authService.login(user);
  }

  // OAuth - GitHub
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth' })
  githubAuth() {
    // handled by passport
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@CurrentUser() user: User) {
    return this.authService.login(user);
  }

  // TOTP
  @Post('totp/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret and QR code' })
  async totpSetup(@CurrentUser() user: User) {
    return this.totpService.generateSetup(user);
  }

  @Post('totp/enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Enable TOTP after verifying first code' })
  async totpEnable(@CurrentUser() user: User, @Body() dto: TotpVerifyDto) {
    await this.totpService.enable(user, dto.token);
  }

  @Post('totp/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable TOTP (requires valid current code)' })
  async totpDisable(@CurrentUser() user: User, @Body() dto: TotpVerifyDto) {
    await this.totpService.disable(user, dto.token);
  }

  @Public()
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with TOTP code (second factor)' })
  async totpVerifyLogin(
    @Body('userId') userId: string,
    @Body('token') token: string,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.loginWithTotp(userId, token, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // WebAuthn
  @Post('webauthn/register/options')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WebAuthn registration options (Touch ID / Face ID)' })
  async webauthnRegisterOptions(@CurrentUser('id') userId: string) {
    return this.webauthnService.generateRegistrationOptions(userId);
  }

  @Post('webauthn/register/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify WebAuthn registration' })
  async webauthnRegisterVerify(
    @CurrentUser('id') userId: string,
    @Body() response: RegistrationResponseJSON,
  ) {
    return this.webauthnService.verifyRegistration(userId, response);
  }

  @Public()
  @Post('webauthn/authenticate/options')
  @ApiOperation({ summary: 'Get WebAuthn authentication options' })
  async webauthnAuthOptions(@Body('email') email: string) {
    return this.webauthnService.generateAuthenticationOptions(email);
  }

  @Public()
  @Post('webauthn/authenticate/verify')
  @ApiOperation({
    summary: 'Verify WebAuthn authentication (Touch ID / Face ID)',
  })
  async webauthnAuthVerify(
    @Body('email') email: string,
    @Body('response') response: AuthenticationResponseJSON,
  ) {
    const user = await this.webauthnService.verifyAuthentication(email, response);
    return this.authService.login(user);
  }
}
