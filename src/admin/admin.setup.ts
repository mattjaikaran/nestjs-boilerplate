import { buildAuthenticatedRouter } from '@adminjs/fastify';
import Adapter, { Database, Resource } from '@adminjs/sql';
import AdminJS from 'adminjs';
import { verify } from 'argon2';

AdminJS.registerAdapter({ Database, Resource });

interface AdminSetupOptions {
  databaseUrl: string;
  databaseName: string;
  appName: string;
  cookieSecret: string;
  port: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setupAdmin(fastify: any, opts: AdminSetupOptions): Promise<void> {
  const { databaseUrl, databaseName, appName, cookieSecret, port } = opts;

  const db = await new Adapter('postgresql', {
    connectionString: databaseUrl,
    database: databaseName,
  }).init();

  const admin = new AdminJS({
    rootPath: '/admin',
    resources: [
      // ── Users ──────────────────────────────────────────────────────────────
      {
        resource: db.table('users'),
        options: {
          navigation: { name: 'Users', icon: 'User' },
          sort: { direction: 'desc', sortBy: 'created_at' },
          properties: {
            password: { isVisible: false },
            totp_secret: { isVisible: false },
            webauthn_credentials: {
              isVisible: { list: false, show: false, edit: false, filter: false },
            },
            metadata: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            created_at: { isDisabled: true },
            updated_at: { isDisabled: true },
            deleted_at: { isDisabled: true },
            role: {
              availableValues: [
                { label: 'Admin', value: 'admin' },
                { label: 'User', value: 'user' },
                { label: 'Moderator', value: 'moderator' },
              ],
            },
            provider: {
              availableValues: [
                { label: 'Local', value: 'local' },
                { label: 'Google', value: 'google' },
                { label: 'GitHub', value: 'github' },
              ],
            },
          },
          listProperties: [
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'is_email_verified',
            'provider',
            'last_login_at',
            'created_at',
          ],
          showProperties: [
            'id',
            'email',
            'first_name',
            'last_name',
            'role',
            'provider',
            'is_active',
            'is_email_verified',
            'is_totp_enabled',
            'avatar_url',
            'last_login_at',
            'metadata',
            'created_at',
            'updated_at',
            'deleted_at',
          ],
          filterProperties: [
            'email',
            'role',
            'is_active',
            'is_email_verified',
            'provider',
            'created_at',
          ],
          editProperties: [
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'is_email_verified',
            'avatar_url',
          ],
          actions: {
            new: {
              isAccessible: false,
            },
          },
        },
      },

      // ── Todos ──────────────────────────────────────────────────────────────
      {
        resource: db.table('todos'),
        options: {
          navigation: { name: 'Content', icon: 'CheckSquare' },
          sort: { direction: 'desc', sortBy: 'created_at' },
          properties: {
            metadata: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            tags: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            created_at: { isDisabled: true },
            updated_at: { isDisabled: true },
            deleted_at: { isDisabled: true },
            status: {
              availableValues: [
                { label: 'Pending', value: 'pending' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
              ],
            },
            priority: {
              availableValues: [
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ],
            },
          },
          listProperties: [
            'title',
            'status',
            'priority',
            'is_completed',
            'user_id',
            'due_date',
            'created_at',
          ],
          showProperties: [
            'id',
            'title',
            'description',
            'status',
            'priority',
            'is_completed',
            'due_date',
            'completed_at',
            'tags',
            'user_id',
            'metadata',
            'created_at',
            'updated_at',
          ],
          filterProperties: ['status', 'priority', 'is_completed', 'user_id', 'created_at'],
          editProperties: [
            'title',
            'description',
            'status',
            'priority',
            'is_completed',
            'due_date',
            'user_id',
          ],
        },
      },

      // ── Audit Logs (read-only) ─────────────────────────────────────────────
      {
        resource: db.table('audit_logs'),
        options: {
          navigation: { name: 'System', icon: 'Activity' },
          sort: { direction: 'desc', sortBy: 'created_at' },
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
            bulkDelete: { isAccessible: false },
          },
          properties: {
            before: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            after: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            metadata: {
              isVisible: { list: false, show: true, edit: false, filter: false },
            },
            action: {
              availableValues: [
                { label: 'Create', value: 'create' },
                { label: 'Update', value: 'update' },
                { label: 'Delete', value: 'delete' },
                { label: 'Login', value: 'login' },
                { label: 'Logout', value: 'logout' },
                { label: 'Password Reset', value: 'password_reset' },
                { label: 'Email Verified', value: 'email_verified' },
                { label: 'API Key Created', value: 'api_key_created' },
                { label: 'API Key Revoked', value: 'api_key_revoked' },
                { label: 'Export', value: 'export' },
                { label: 'Other', value: 'other' },
              ],
            },
          },
          listProperties: [
            'user_id',
            'action',
            'resource',
            'resource_id',
            'ip_address',
            'created_at',
          ],
          showProperties: [
            'id',
            'user_id',
            'action',
            'resource',
            'resource_id',
            'before',
            'after',
            'metadata',
            'ip_address',
            'user_agent',
            'created_at',
          ],
          filterProperties: ['action', 'resource', 'user_id', 'ip_address', 'created_at'],
        },
      },

      // ── Payments (read-only) ───────────────────────────────────────────────
      {
        resource: db.table('payments'),
        options: {
          navigation: { name: 'Billing', icon: 'CreditCard' },
          sort: { direction: 'desc', sortBy: 'created_at' },
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
            bulkDelete: { isAccessible: false },
          },
          properties: {
            status: {
              availableValues: [
                { label: 'Succeeded', value: 'succeeded' },
                { label: 'Pending', value: 'pending' },
                { label: 'Failed', value: 'failed' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Canceled', value: 'canceled' },
              ],
            },
          },
          listProperties: [
            'user_id',
            'amount',
            'currency',
            'status',
            'stripe_payment_intent_id',
            'created_at',
          ],
          showProperties: [
            'id',
            'user_id',
            'stripe_customer_id',
            'stripe_payment_intent_id',
            'stripe_checkout_session_id',
            'amount',
            'currency',
            'status',
            'description',
            'created_at',
            'updated_at',
          ],
          filterProperties: ['status', 'currency', 'user_id', 'created_at'],
        },
      },

      // ── Subscriptions (read-only) ──────────────────────────────────────────
      {
        resource: db.table('subscriptions'),
        options: {
          navigation: { name: 'Billing', icon: 'CreditCard' },
          sort: { direction: 'desc', sortBy: 'created_at' },
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
            bulkDelete: { isAccessible: false },
          },
          properties: {
            status: {
              availableValues: [
                { label: 'Active', value: 'active' },
                { label: 'Canceled', value: 'canceled' },
                { label: 'Incomplete', value: 'incomplete' },
                { label: 'Incomplete Expired', value: 'incomplete_expired' },
                { label: 'Past Due', value: 'past_due' },
                { label: 'Paused', value: 'paused' },
                { label: 'Trialing', value: 'trialing' },
                { label: 'Unpaid', value: 'unpaid' },
              ],
            },
          },
          listProperties: [
            'user_id',
            'status',
            'stripe_subscription_id',
            'current_period_start',
            'current_period_end',
            'created_at',
          ],
          showProperties: [
            'id',
            'user_id',
            'stripe_customer_id',
            'stripe_subscription_id',
            'stripe_price_id',
            'stripe_product_id',
            'status',
            'current_period_start',
            'current_period_end',
            'cancel_at_period_end',
            'canceled_at',
            'trial_start',
            'trial_end',
            'created_at',
            'updated_at',
          ],
          filterProperties: ['status', 'user_id', 'created_at'],
        },
      },
    ],

    branding: {
      companyName: appName,
      logo: false,
      favicon: '/favicon.ico',
      withMadeWithLove: false,
    },

    locale: {
      language: 'en',
      availableLanguages: ['en'],
    },
  });

  await buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email: string, password: string) => {
        // Access the shared knex instance via any ResourceMetadata's .knex property
        const knex = (db.table('users') as any).knex as import('knex').Knex;
        const user = await knex('users')
          .where({ email: email.toLowerCase(), role: 'admin', is_active: true })
          .whereNull('deleted_at')
          .first<{ id: string; email: string; role: string; password: string | null }>();

        if (!user?.password) return null;

        const valid = await verify(user.password, password);
        if (!valid) return null;

        return { email: user.email, role: user.role, id: user.id };
      },
      cookieName: 'adminjs',
      cookiePassword: cookieSecret,
    },
    fastify,
    { saveUninitialized: false },
  );

  console.log(`Admin panel: http://localhost:${port}/admin`);
}
