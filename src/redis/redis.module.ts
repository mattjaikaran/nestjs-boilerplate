import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url', 'redis://localhost:6379');
        const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
        client.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNREFUSED') {
            console.error('[Redis]', err.message);
          }
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    // clients close themselves on process exit
  }
}
