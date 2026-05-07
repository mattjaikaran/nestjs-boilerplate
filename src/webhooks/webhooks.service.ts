import { createHmac, randomBytes } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, desc, eq, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/drizzle.module';
import * as schema from '../database/schema';
import type { CreateWebhookDto } from './dto/create-webhook.dto';
import type { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WEBHOOK_QUEUE } from './webhooks.constants';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    @InjectQueue(WEBHOOK_QUEUE) private webhookQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateWebhookDto) {
    const secret = randomBytes(32).toString('hex');
    const [endpoint] = await this.db
      .insert(schema.webhookEndpoints)
      .values({
        userId,
        url: dto.url,
        secret,
        events: dto.events,
        description: dto.description,
      })
      .returning();

    return { ...endpoint, secret }; // Return plain secret once on creation
  }

  async findAll(userId: string) {
    return this.db
      .select({
        id: schema.webhookEndpoints.id,
        url: schema.webhookEndpoints.url,
        events: schema.webhookEndpoints.events,
        description: schema.webhookEndpoints.description,
        isActive: schema.webhookEndpoints.isActive,
        createdAt: schema.webhookEndpoints.createdAt,
      })
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.userId, userId))
      .orderBy(desc(schema.webhookEndpoints.createdAt));
  }

  async findOne(userId: string, id: string) {
    const [endpoint] = await this.db
      .select({
        id: schema.webhookEndpoints.id,
        url: schema.webhookEndpoints.url,
        events: schema.webhookEndpoints.events,
        description: schema.webhookEndpoints.description,
        isActive: schema.webhookEndpoints.isActive,
        createdAt: schema.webhookEndpoints.createdAt,
        updatedAt: schema.webhookEndpoints.updatedAt,
      })
      .from(schema.webhookEndpoints)
      .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, userId)));

    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  async update(userId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOne(userId, id);
    const [updated] = await this.db
      .update(schema.webhookEndpoints)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, userId)))
      .returning({ id: schema.webhookEndpoints.id });

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.db
      .delete(schema.webhookEndpoints)
      .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, userId)));
  }

  async rotateSecret(userId: string, id: string) {
    await this.findOne(userId, id);
    const secret = randomBytes(32).toString('hex');
    await this.db
      .update(schema.webhookEndpoints)
      .set({ secret, updatedAt: new Date() })
      .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, userId)));

    return { secret };
  }

  async getDeliveries(userId: string, endpointId: string) {
    await this.findOne(userId, endpointId);
    return this.db
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.endpointId, endpointId))
      .orderBy(desc(schema.webhookDeliveries.createdAt))
      .limit(100);
  }

  /** Called by the domain event listener — fans out to all matching endpoints */
  async dispatch(eventType: string, payload: Record<string, unknown>) {
    const endpoints = await this.db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.isActive, true));

    const matched = endpoints.filter((ep) => {
      const events = ep.events as string[];
      return events.includes('*') || events.includes(eventType);
    });

    await Promise.all(
      matched.map(async (ep) => {
        const [delivery] = await this.db
          .insert(schema.webhookDeliveries)
          .values({ endpointId: ep.id, eventType, payload, status: 'pending' })
          .returning();

        await this.webhookQueue.add(
          'deliver',
          { deliveryId: delivery.id, endpointId: ep.id, eventType, payload, secret: ep.secret },
          { jobId: delivery.id, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
        );
      }),
    );
  }

  /** Builds the HMAC-SHA256 signature header value */
  static sign(secret: string, body: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }
}
