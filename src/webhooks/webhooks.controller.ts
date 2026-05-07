import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  @ApiResponse({ status: 201, description: 'Endpoint created. Secret returned once — store it.' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your webhook endpoints' })
  findAll(@CurrentUser('id') userId: string) {
    return this.webhooksService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint' })
  findOne(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.remove(userId, id);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate the signing secret for a webhook endpoint' })
  rotateSecret(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.rotateSecret(userId, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List delivery attempts for a webhook endpoint (last 100)' })
  getDeliveries(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.getDeliveries(userId, id);
  }
}
