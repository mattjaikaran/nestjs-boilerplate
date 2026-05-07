import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://myapp.com/webhooks/nestjs', description: 'HTTPS endpoint URL' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({
    example: ['user.registered', 'todo.created'],
    description: 'Event types to subscribe to. Use ["*"] to receive all events.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({ example: 'Production webhook endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
