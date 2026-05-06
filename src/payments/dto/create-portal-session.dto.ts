import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePortalSessionDto {
  @ApiPropertyOptional({ description: 'Return URL after leaving the billing portal' })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
