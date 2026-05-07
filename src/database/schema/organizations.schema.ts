import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { subscriptionStatusEnum } from './payments.schema';
import { users } from './users.schema';

export const orgMemberRoleEnum = pgEnum('org_member_role', ['owner', 'admin', 'member']);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    logoUrl: text('logo_url'),
    website: varchar('website', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    metadata: text('metadata'), // JSON blob for custom fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('organizations_owner_id_idx').on(t.ownerId),
    index('organizations_slug_idx').on(t.slug),
  ],
);

// ─── Organization Members ─────────────────────────────────────────────────────

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('org_members_org_id_idx').on(t.organizationId),
    index('org_members_user_id_idx').on(t.userId),
    // unique member per org
    index('org_members_org_user_idx').on(t.organizationId, t.userId),
  ],
);

// ─── Invitations ──────────────────────────────────────────────────────────────

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: orgMemberRoleEnum('role').default('member').notNull(),
    token: varchar('token', { length: 128 }).notNull().unique(),
    invitedById: uuid('invited_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: invitationStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('invitations_org_id_idx').on(t.organizationId),
    index('invitations_email_idx').on(t.email),
    index('invitations_token_idx').on(t.token),
  ],
);

// ─── Org Subscriptions (B2B billing) ─────────────────────────────────────────

export const orgSubscriptions = pgTable(
  'org_subscriptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .unique(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
    stripePriceId: varchar('stripe_price_id', { length: 255 }).notNull(),
    stripeProductId: varchar('stripe_product_id', { length: 255 }).notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    seats: integer('seats').default(5).notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('org_subs_org_id_idx').on(t.organizationId),
    index('org_subs_stripe_customer_idx').on(t.stripeCustomerId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  invitations: many(invitations),
  subscription: one(orgSubscriptions, {
    fields: [organizations.id],
    references: [orgSubscriptions.organizationId],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, { fields: [invitations.invitedById], references: [users.id] }),
}));

export const orgSubscriptionsRelations = relations(orgSubscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgSubscriptions.organizationId],
    references: [organizations.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type OrgSubscription = typeof orgSubscriptions.$inferSelect;
export type NewOrgSubscription = typeof orgSubscriptions.$inferInsert;
export type OrgMemberRole = OrganizationMember['role'];
