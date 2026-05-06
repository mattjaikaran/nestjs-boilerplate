import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

  notifyUser(userId: string, payload: NotificationPayload) {
    this.gateway.sendToUser(userId, 'notification', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  notifyRoom(room: string, payload: NotificationPayload) {
    this.gateway.sendToRoom(room, 'notification', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  broadcast(payload: NotificationPayload) {
    this.gateway.broadcast('notification', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }
}
