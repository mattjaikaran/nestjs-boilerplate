import * as crypto from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { REDIS_CLIENT } from '../redis/redis.module';

const PKCE_TTL_SECONDS = 600; // 10 minutes
const AUTH_CODE_TTL_SECONDS = 120; // 2 minutes to exchange code

export interface PkceState {
  codeChallenge: string;
  redirectUri: string;
  provider: 'google' | 'github';
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
}

export interface GitHubUserInfo {
  id: number;
  email: string | null;
  name: string;
  avatar_url?: string;
}

@Injectable()
export class PkceService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
  ) {}

  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async storeState(state: string, data: PkceState): Promise<void> {
    await this.redis.set(`pkce:state:${state}`, JSON.stringify(data), 'EX', PKCE_TTL_SECONDS);
  }

  async resolveState(state: string): Promise<PkceState> {
    const raw = await this.redis.getdel(`pkce:state:${state}`);
    if (!raw)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Invalid or expired OAuth state',
        HttpStatus.BAD_REQUEST,
      );
    return JSON.parse(raw) as PkceState;
  }

  /** Issue a short-lived one-time auth code tied to a code_challenge */
  async issueAuthCode(codeChallenge: string, userId: string): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    await this.redis.set(
      `pkce:code:${code}`,
      JSON.stringify({ codeChallenge, userId }),
      'EX',
      AUTH_CODE_TTL_SECONDS,
    );
    return code;
  }

  /** Consume code + verify code_verifier against stored code_challenge; returns userId */
  async consumeAuthCode(code: string, codeVerifier: string): Promise<string> {
    const raw = await this.redis.getdel(`pkce:code:${code}`);
    if (!raw)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Invalid or expired auth code',
        HttpStatus.BAD_REQUEST,
      );

    const { codeChallenge, userId } = JSON.parse(raw) as {
      codeChallenge: string;
      userId: string;
    };

    const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    if (computed !== codeChallenge)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'code_verifier does not match code_challenge',
        HttpStatus.BAD_REQUEST,
      );

    return userId;
  }

  buildAuthUrl(provider: 'google' | 'github', state: string): string {
    const baseUrl = this.config.getOrThrow<string>('APP_URL');

    if (provider === 'google') {
      const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
      const callbackUrl = `${baseUrl}/api/v1/auth/google/pkce/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'email profile',
        state,
        access_type: 'offline',
        prompt: 'consent',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    const clientId = this.config.getOrThrow<string>('GITHUB_CLIENT_ID');
    const callbackUrl = `${baseUrl}/api/v1/auth/github/pkce/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
    const baseUrl = this.config.getOrThrow<string>('APP_URL');
    const callbackUrl = `${baseUrl}/api/v1/auth/google/pkce/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GOOGLE_CLIENT_SECRET'),
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Google token exchange failed',
        HttpStatus.UNAUTHORIZED,
      );

    const { access_token } = (await tokenRes.json()) as OAuthTokenResponse;

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Failed to fetch Google user info',
        HttpStatus.UNAUTHORIZED,
      );

    return userRes.json() as Promise<GoogleUserInfo>;
  }

  async exchangeGitHubCode(code: string): Promise<GitHubUserInfo> {
    const baseUrl = this.config.getOrThrow<string>('APP_URL');
    const callbackUrl = `${baseUrl}/api/v1/auth/github/pkce/callback`;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: this.config.getOrThrow('GITHUB_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GITHUB_CLIENT_SECRET'),
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok)
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'GitHub token exchange failed',
        HttpStatus.UNAUTHORIZED,
      );

    const { access_token } = (await tokenRes.json()) as OAuthTokenResponse;

    const [userRes, emailRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ]);

    const user = (await userRes.json()) as GitHubUserInfo;

    if (!user.email) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) user.email = primary.email;
    }

    return user;
  }
}
