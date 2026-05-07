import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'URL-safe slug (a-z, 0-9, hyphens)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug may only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class InviteMemberDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ enum: ['admin', 'member'], default: 'member' })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
