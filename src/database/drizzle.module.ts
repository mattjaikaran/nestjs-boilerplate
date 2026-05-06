import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDB => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL');
        const client = postgres(connectionString, {
          max: config.get<number>('DB_POOL_MAX', 10),
          idle_timeout: 20,
          connect_timeout: 10,
          prepare: false,
        });
        return drizzle(client, {
          schema,
          logger: config.get('NODE_ENV') === 'development',
        });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
