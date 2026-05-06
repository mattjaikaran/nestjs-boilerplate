import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class MagicLinkDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}
