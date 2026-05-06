import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { EmailModule } from '../email/email.module';
import { EmailProcessor } from './email.processor';
import { EMAIL_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

type FastifyRequest = { headers: Record<string, string> };
type FastifyReply = { code: (n: number) => { send: (b: unknown) => void } };

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url', 'redis://localhost:6379'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    BullBoardModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        route: '/admin/queues',
        adapter: BullBoardFastifyAdapter,
        // Fastify preHandler — requires valid JWT with admin role
        middleware: (req: FastifyRequest, reply: FastifyReply, next: () => void) => {
          const auth = req.headers?.authorization;
          if (!auth?.startsWith('Bearer ')) {
            reply.code(401).send({ message: 'Unauthorized' });
            return;
          }
          try {
            const secret = config.getOrThrow<string>('JWT_SECRET');
            const payload = jwt.verify(auth.slice(7), secret) as { role?: string };
            if (payload.role !== 'admin') {
              reply.code(403).send({ message: 'Forbidden' });
              return;
            }
            next();
          } catch {
            reply.code(401).send({ message: 'Unauthorized' });
          }
        },
      }),
    }),
    BullBoardModule.forFeature({ name: EMAIL_QUEUE, adapter: BullMQAdapter }),
    EmailModule,
  ],
  providers: [EmailProcessor, QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
