import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/drizzle.module';
import * as schema from '../database/schema';
import { WEBHOOK_QUEUE } from './webhooks.constants';
import { WebhooksService } from './webhooks.service';

interface DeliverJobData {
  deliveryId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  secret: string;
}

@Processor(WEBHOOK_QUEUE)
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {
    super();
  }

  async process(job: Job<DeliverJobData>): Promise<void> {
    const { deliveryId, eventType, payload, secret } = job.data;

    const [delivery] = await this.db
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, deliveryId));

    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found, skipping`);
      return;
    }

    const [endpoint] = await this.db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.id, delivery.endpointId));

    if (!endpoint || !endpoint.isActive) {
      await this.markFailed(deliveryId, job.attemptsMade, 0, 'Endpoint disabled or deleted');
      return;
    }

    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = WebhooksService.sign(secret, body);

    let statusCode = 0;
    let responseBody = '';

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery': deliveryId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.db
          .update(schema.webhookDeliveries)
          .set({
            status: 'success',
            statusCode,
            responseBody,
            deliveredAt: new Date(),
            attemptCount: job.attemptsMade + 1,
          })
          .where(eq(schema.webhookDeliveries.id, deliveryId));

        this.logger.log(`Delivered ${eventType} to ${endpoint.url} [${statusCode}]`);
        return;
      }

      throw new Error(`HTTP ${statusCode}: ${responseBody.slice(0, 200)}`);
    } catch (err) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 5);
      this.logger.warn(
        `Webhook delivery ${deliveryId} attempt ${job.attemptsMade + 1} failed: ${(err as Error).message}`,
      );

      if (isLastAttempt) {
        await this.markFailed(deliveryId, job.attemptsMade + 1, statusCode, responseBody);
      } else {
        await this.db
          .update(schema.webhookDeliveries)
          .set({ attemptCount: job.attemptsMade + 1, statusCode })
          .where(eq(schema.webhookDeliveries.id, deliveryId));
      }

      throw err; // Let BullMQ handle the retry
    }
  }

  private async markFailed(
    deliveryId: string,
    attempts: number,
    statusCode: number,
    responseBody: string,
  ) {
    await this.db
      .update(schema.webhookDeliveries)
      .set({ status: 'failed', statusCode, responseBody, attemptCount: attempts })
      .where(eq(schema.webhookDeliveries.id, deliveryId));
  }
}
