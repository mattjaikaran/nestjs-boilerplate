import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AppCacheModule } from './cache/cache.module';
import { DomainEventListener } from './common/events/domain-event.listener';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import stripeConfig from './config/stripe.config';
import { DrizzleModule } from './database/drizzle.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TodosModule } from './todos/todos.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        authConfig,
        stripeConfig,
        redisConfig,
        storageConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      expandVariables: true,
      cache: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      ignoreErrors: false,
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    AppCacheModule,
    DrizzleModule,
    RedisModule,
    QueueModule,
    MetricsModule,
    SchedulerModule,
    AuthModule,
    UsersModule,
    TodosModule,
    UploadsModule,
    AuditModule,
    HealthModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DomainEventListener,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
