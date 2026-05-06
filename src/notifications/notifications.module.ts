import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [ConfigModule, JwtModule],
  providers: [NotificationsGateway, NotificationsService, WsJwtGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
