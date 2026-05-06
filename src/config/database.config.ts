import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolMax: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
  ssl: process.env.DB_SSL === 'true',
}));
