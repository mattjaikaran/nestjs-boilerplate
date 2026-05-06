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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a feature flag (admin)' })
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all feature flags (admin)' })
  findAll() {
    return this.featureFlagsService.findAll();
  }

  @Get(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a feature flag by key (admin)' })
  findOne(@Param('key') key: string) {
    return this.featureFlagsService.findByKey(key);
  }

  @Get(':key/check')
  @Public()
  @ApiOperation({ summary: 'Check if a feature flag is enabled for the current user' })
  async check(@Param('key') key: string, @CurrentUser() user?: { id: string }) {
    const enabled = await this.featureFlagsService.isEnabled(key, user?.id);
    return { key, enabled };
  }

  @Patch(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a feature flag (admin)' })
  update(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.featureFlagsService.update(key, dto);
  }

  @Delete(':key')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag (admin)' })
  remove(@Param('key') key: string) {
    return this.featureFlagsService.remove(key);
  }
}
