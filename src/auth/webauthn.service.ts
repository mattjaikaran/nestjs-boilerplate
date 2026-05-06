import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
import type { User, WebAuthnCredential } from '../database/schema';
import type { UsersService } from '../users/users.service';

@Injectable()
export class WebAuthnService {
  private readonly rpName: string;
  private readonly rpID: string;
  private readonly origin: string | string[];

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    this.rpName = configService.get('WEBAUTHN_RP_NAME', 'NestJS Boilerplate');
    this.rpID = configService.get('WEBAUTHN_RP_ID', 'localhost');
    const origin = configService.get('WEBAUTHN_ORIGIN', 'http://localhost:3000');
    this.origin = origin.includes(',') ? origin.split(',') : origin;
  }

  async generateRegistrationOptions(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const existingCredentials = (user.webauthnCredentials ?? []).map((c) => ({ id: c.id }));

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      attestationType: 'none',
      excludeCredentials: existingCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    await this.usersService.update(userId, {
      metadata: { ...(user.metadata ?? {}), webauthnChallenge: options.challenge },
    });

    return options;
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const expectedChallenge = user.metadata?.webauthnChallenge as string | undefined;
    if (!expectedChallenge) throw new BadRequestException('No pending registration challenge');

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verified || !registrationInfo)
      throw new BadRequestException('Registration verification failed');

    const { credential } = registrationInfo;

    const newCredential: WebAuthnCredential = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: response.response.transports as string[],
      createdAt: new Date().toISOString(),
    };

    const updated = [...(user.webauthnCredentials ?? []), newCredential];
    await this.usersService.update(userId, {
      webauthnCredentials: updated,
      metadata: { ...(user.metadata ?? {}), webauthnChallenge: undefined },
    });

    return { verified: true };
  }

  async generateAuthenticationOptions(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user?.webauthnCredentials?.length) {
      throw new BadRequestException('No WebAuthn credentials registered for this account');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: user.webauthnCredentials.map((c) => ({ id: c.id })),
      userVerification: 'preferred',
    });

    await this.usersService.update(user.id, {
      metadata: { ...(user.metadata ?? {}), webauthnChallenge: options.challenge },
    });

    return options;
  }

  async verifyAuthentication(email: string, response: AuthenticationResponseJSON): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('User not found');

    const credential = user.webauthnCredentials?.find((c) => c.id === response.id);
    if (!credential) throw new BadRequestException('Credential not found');

    const expectedChallenge = user.metadata?.webauthnChallenge as string | undefined;
    if (!expectedChallenge) throw new BadRequestException('No pending authentication challenge');

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey, 'base64'),
        counter: credential.counter,
        transports: credential.transports as never[],
      },
    });

    if (!verified) throw new BadRequestException('Authentication verification failed');

    credential.counter = authenticationInfo.newCounter;
    await this.usersService.update(user.id, {
      webauthnCredentials: user.webauthnCredentials,
      metadata: { ...(user.metadata ?? {}), webauthnChallenge: undefined },
    });

    const updated = await this.usersService.findById(user.id);
    if (!updated) throw new BadRequestException('User not found after verification');
    return updated;
  }
}
