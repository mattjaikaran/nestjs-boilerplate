import { Injectable, Optional } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationsGateway } from './notifications.gateway';

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface SendNotificationOptions {
  /** Send in-app notification via WebSocket */
  realtime?: boolean;
  /** Send an email notification via BullMQ */
  email?: string;
  /** Optional deep-link for the email CTA */
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: NotificationsGateway,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  async notifyUser(
    userId: string,
    payload: NotificationPayload,
    opts: SendNotificationOptions = { realtime: true },
  ) {
    const full = { ...payload, timestamp: payload.timestamp ?? new Date().toISOString() };

    if (opts.realtime !== false) {
      this.gateway.sendToUser(userId, 'notification', full);
    }

    if (opts.email && this.queueService) {
      await this.queueService.sendNotificationEmail(
        opts.email,
        payload.title,
        payload.message,
        opts.actionUrl,
      );
    }
  }

  async notifyRoom(
    room: string,
    payload: NotificationPayload,
    opts: SendNotificationOptions = { realtime: true },
  ) {
    const full = { ...payload, timestamp: payload.timestamp ?? new Date().toISOString() };

    if (opts.realtime !== false) {
      this.gateway.sendToRoom(room, 'notification', full);
    }
  }

  broadcast(payload: NotificationPayload) {
    this.gateway.broadcast('notification', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }
}
