import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

dotenv.config();

const DATABASE_URL =
  process.env.DATABASE_URL ??
  (() => {
    throw new Error('DATABASE_URL is required');
  })();

async function reset() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log('Resetting database schema...');

  await db.execute(sql`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO PUBLIC;
  `);

  console.log('Schema reset. Run `bun run db:migrate` to re-apply migrations.');

  await client.end();
  process.exit(0);
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
