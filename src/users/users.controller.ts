import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from '../auth/api-key.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { PaginationDto } from '../common/dto/pagination.dto';
import type { User } from '../database/schema';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto as never);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteMe(@CurrentUser('id') userId: string) {
    await this.usersService.softDelete(userId);
  }

  // API Key management
  @Get('me/api-keys')
  @ApiOperation({ summary: 'List API keys for current user' })
  listApiKeys(@CurrentUser('id') userId: string) {
    return this.apiKeyService.findAllForUser(userId);
  }

  @Post('me/api-keys')
  @ApiOperation({ summary: 'Create a new API key' })
  createApiKey(@CurrentUser('id') userId: string, @Body() dto: CreateApiKeyDto) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    return this.apiKeyService.create(userId, dto.name, expiresAt);
  }

  @Delete('me/api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revokeApiKey(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.apiKeyService.revoke(id, userId);
  }

  @Delete('me/api-keys')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all API keys' })
  async revokeAllApiKeys(@CurrentUser('id') userId: string) {
    await this.apiKeyService.revokeAll(userId);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users (admin only)' })
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
