import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebhooksService } from './webhooks.service';

/**
 * Bridges the internal domain event bus to outbound webhook delivery.
 * Any event emitted via EventEmitter2 with a string name is fan-out eligible.
 */
@Injectable()
export class WebhooksListener {
  private readonly logger = new Logger(WebhooksListener.name);

  constructor(private readonly webhooks: WebhooksService) {}

  @OnEvent('**', { async: true })
  async onAnyEvent(payload: unknown, eventName: string | symbol) {
    if (typeof eventName !== 'string') return;

    try {
      await this.webhooks.dispatch(eventName, payload as Record<string, unknown>);
    } catch (err) {
      this.logger.error(
        `Failed to enqueue webhook for event ${eventName}: ${(err as Error).message}`,
      );
    }
  }
}
