import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export type OtpType = 'email_verification' | 'password_reset' | 'magic_link' | 'two_factor';

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: ['email_verification', 'password_reset', 'magic_link', 'two_factor'] })
  @IsEnum(['email_verification', 'password_reset', 'magic_link', 'two_factor'])
  type: OtpType;
}
