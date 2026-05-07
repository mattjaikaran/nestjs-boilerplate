import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUrl, Length, Matches } from 'class-validator';

export class PkceAuthorizeDto {
  @ApiProperty({ enum: ['google', 'github'], example: 'google' })
  @IsIn(['google', 'github'])
  provider: 'google' | 'github';

  /** BASE64URL(SHA256(code_verifier)) */
  @ApiProperty({ example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' })
  @IsString()
  @Length(43, 128)
  codeChallenge: string;

  @ApiProperty({ example: 'https://myapp.com/auth/callback' })
  @IsUrl({ require_tld: false })
  redirectUri: string;
}

export class PkceTokenDto {
  @ApiProperty({ description: 'One-time auth code from OAuth callback redirect' })
  @IsString()
  @Length(64, 64)
  code: string;

  /** Random 43-128 char string matching the challenge */
  @ApiProperty({ description: 'Code verifier (43-128 chars, BASE64URL chars only)' })
  @IsString()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9\-._~]+$/)
  codeVerifier: string;
}
