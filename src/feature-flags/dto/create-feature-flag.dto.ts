import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'new-dashboard', description: 'Unique slug key for the flag' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'key must be lowercase alphanumeric with dashes/underscores',
  })
  key: string;

  @ApiProperty({ example: 'New Dashboard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Enables the redesigned dashboard UI' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 100, description: 'Rollout percentage 0–100', default: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;

  @ApiPropertyOptional({ description: 'Optional targeting conditions (JSON)' })
  @IsObject()
  @IsOptional()
  conditions?: Record<string, unknown>;
}
