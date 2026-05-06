import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { todos, users } from '../src/database/schema';

dotenv.config();

const DATABASE_URL =
  process.env.DATABASE_URL ??
  (() => {
    throw new Error('DATABASE_URL is required');
  })();

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log('Seeding database...');

  const password = await argon2.hash('Password123!');

  // Admin user
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      password,
      role: 'admin',
      isEmailVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  console.log('Admin user: admin@example.com / Password123!');

  // Regular users
  const regularUsers = await db
    .insert(users)
    .values([
      {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        password,
        role: 'user',
        isEmailVerified: true,
      },
      {
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        password,
        role: 'user',
        isEmailVerified: true,
      },
      {
        email: 'carol@example.com',
        firstName: 'Carol',
        lastName: 'White',
        password,
        role: 'user',
        isEmailVerified: true,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`Created ${regularUsers.length} regular users`);

  // Seed todos for each user
  const allUsers = [admin, ...regularUsers].filter(Boolean);
  for (const user of allUsers) {
    if (!user) continue;
    await db
      .insert(todos)
      .values([
        {
          title: 'Set up development environment',
          status: 'completed',
          priority: 'high',
          userId: user.id,
          isCompleted: true,
        },
        {
          title: 'Read project documentation',
          status: 'in_progress',
          priority: 'medium',
          userId: user.id,
        },
        {
          title: 'Write unit tests',
          status: 'pending',
          priority: 'high',
          userId: user.id,
          tags: ['testing', 'quality'],
        },
        {
          title: 'Review pull requests',
          status: 'pending',
          priority: 'low',
          userId: user.id,
          tags: ['review'],
        },
        {
          title: 'Deploy to staging',
          status: 'pending',
          priority: 'medium',
          userId: user.id,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ])
      .onConflictDoNothing();
  }
  console.log(`Created todos for ${allUsers.length} users`);

  console.log('\nSeed complete!');
  console.log('   Credentials: <email> / Password123!');

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
