import path from 'node:path';
/**
 * Standalone migration runner — compiled to dist/database/migrate.js
 * Called by docker/entrypoint.sh before the API starts.
 * Uses drizzle-orm/migrator directly, no drizzle-kit needed at runtime.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

async function runMigrations() {
  console.log('[migrate] Connecting to database...');
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const db = drizzle(client);

  // migrationsFolder is relative to CWD — works from /app in container
  const migrationsFolder = path.join(process.cwd(), 'src/database/migrations');

  console.log(`[migrate] Running migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] Migrations complete');

  await client.end();
}

runMigrations().catch((err) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
