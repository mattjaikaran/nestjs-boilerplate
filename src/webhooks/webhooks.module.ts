import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WEBHOOK_QUEUE } from './webhooks.constants';
import { WebhooksController } from './webhooks.controller';
import { WebhooksListener } from './webhooks.listener';
import { WebhooksProcessor } from './webhooks.processor';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullBoardModule.forFeature({ name: WEBHOOK_QUEUE, adapter: BullMQAdapter }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksProcessor, WebhooksListener],
  exports: [WebhooksService],
})
export class WebhooksModule {}
