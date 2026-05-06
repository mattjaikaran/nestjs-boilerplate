import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const host = config.get('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get('REDIS_PASSWORD');

        try {
          const store = await redisStore({
            host,
            port,
            password: password || undefined,
            ttl: 60 * 5, // 5 minutes default
          });
          return { store, ttl: 60 * 5 };
        } catch {
          // Fallback to in-memory if Redis unavailable
          return { ttl: 60 * 5 };
        }
      },
    }),
  ],
})
export class AppCacheModule {}
