import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'Stripe Price ID for the product/plan' })
  @IsString()
  priceId: string;

  @ApiPropertyOptional({ description: 'Override success redirect URL' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'Override cancel redirect URL' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
