import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { type Profile, Strategy } from 'passport-github2';
import type { AuthService } from '../auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: unknown) => void,
  ) {
    const email = profile.emails?.[0]?.value ?? `${profile.username}@github.local`;
    const displayName = profile.displayName ?? profile.username ?? '';
    const [firstName, ...rest] = displayName.split(' ');

    const user = await this.authService.validateOAuthUser({
      provider: 'github',
      providerId: profile.id,
      email,
      firstName: firstName ?? profile.username ?? '',
      lastName: rest.join(' ') || '',
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user);
  }
}
