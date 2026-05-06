import { execSync } from 'node:child_process';
/**
 * Interactive CLI for adding optional features to the boilerplate.
 * Usage: bun run add:feature
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const ROOT = process.cwd();
const src = (...p: string[]) => path.join(ROOT, 'src', ...p);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

// ─── Helpers ────────────────────────────────────────────────────────────────

function write(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  created  ${path.relative(ROOT, filePath)}`);
}

function patchFile(
  filePath: string,
  marker: string,
  insertion: string,
  direction: 'before' | 'after' = 'after',
) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(insertion.trim().split('\n')[0].trim())) {
    console.log(`  skipped  ${path.relative(ROOT, filePath)} (already patched)`);
    return;
  }
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error(`Marker not found in ${filePath}:\n  "${marker}"`);
  const insert =
    direction === 'after'
      ? `${content.slice(0, idx + marker.length)}\n${insertion}${content.slice(idx + marker.length)}`
      : `${insertion}\n${content.slice(0, idx)}${marker}${content.slice(idx + marker.length)}`;
  fs.writeFileSync(filePath, insert, 'utf8');
  console.log(`  patched  ${path.relative(ROOT, filePath)}`);
}

function alreadyInstalled(checkPath: string) {
  return fs.existsSync(path.join(ROOT, checkPath));
}

// ─── Feature definitions ────────────────────────────────────────────────────

const FEATURES: Record<string, Feature> = {
  organizations: {
    id: 'organizations',
    name: 'Organizations / Multi-tenancy',
    description: 'Teams & orgs with owner/admin/member/viewer roles, invitations via email token',
    checkPath: 'src/organizations',
    install: installOrganizations,
  },
  'feature-flags': {
    id: 'feature-flags',
    name: 'Feature Flags',
    description: 'DB-backed flags with per-user rollout %, @RequireFeatureFlag decorator + guard',
    checkPath: 'src/feature-flags',
    install: installFeatureFlags,
  },
};

interface Feature {
  id: string;
  name: string;
  description: string;
  checkPath: string;
  install: () => void;
}

// ─── Organizations ───────────────────────────────────────────────────────────

function installOrganizations() {
  // Schema
  write(
    src('database/schema/organizations.schema.ts'),
    `import { relations, sql } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { orgRoleEnum } from './enums';
import { users } from './users.schema';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`),
  name: varchar('name', { length: 256 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  plan: varchar('plan', { length: 64 }).notNull().default('free'),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  settings: jsonb('settings').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('org_member_unique_idx').on(t.organizationId, t.userId)],
);

export const organizationInvitations = pgTable('organization_invitations', {
  id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: orgRoleEnum('role').notNull().default('member'),
  token: varchar('token', { length: 128 }).notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const organizationInvitationsRelations = relations(organizationInvitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, { fields: [organizationInvitations.invitedBy], references: [users.id] }),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation = typeof organizationInvitations.$inferInsert;
`,
  );

  // DTOs
  write(
    src('organizations/dto/create-organization.dto.ts'),
    `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'Unique URL-safe slug' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with dashes' })
  slug: string;

  @ApiPropertyOptional({ example: 'free', enum: ['free', 'pro', 'enterprise'] })
  @IsString()
  @IsOptional()
  plan?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
`,
  );

  write(
    src('organizations/dto/update-organization.dto.ts'),
    `import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, ['slug'] as const),
) {}
`,
  );

  write(
    src('organizations/dto/invite-member.dto.ts'),
    `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ enum: ['admin', 'member', 'viewer'], default: 'member' })
  @IsString()
  @IsIn(['admin', 'member', 'viewer'])
  @IsOptional()
  role?: 'admin' | 'member' | 'viewer';
}
`,
  );

  write(
    src('organizations/dto/update-member-role.dto.ts'),
    `import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'member', 'viewer'] })
  @IsString()
  @IsIn(['admin', 'member', 'viewer'])
  role: 'admin' | 'member' | 'viewer';
}
`,
  );

  // Service
  write(
    src('organizations/organizations.service.ts'),
    `import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { organizationInvitations, organizationMembers, organizations } from '../database/schema';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateOrganizationDto, ownerId: string) {
    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: dto.name, slug: dto.slug, plan: dto.plan ?? 'free', ownerId, settings: dto.settings })
        .returning();
      await tx.insert(organizationMembers).values({ organizationId: org.id, userId: ownerId, role: 'owner' });
      return org;
    });
  }

  async findAllForUser(userId: string) {
    return this.db
      .select({ org: organizations, role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(eq(organizationMembers.userId, userId), isNull(organizations.deletedAt)));
  }

  async findOne(orgId: string) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)));
    if (!org) throw new AppException(ErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto, userId: string) {
    await this.requireMinRole(orgId, userId, ['owner', 'admin']);
    const [updated] = await this.db
      .update(organizations)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning();
    return updated;
  }

  async remove(orgId: string, userId: string) {
    await this.requireMinRole(orgId, userId, ['owner']);
    await this.db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, orgId));
  }

  async listMembers(orgId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin', 'member', 'viewer']);
    return this.db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
  }

  async updateMemberRole(orgId: string, targetUserId: string, dto: UpdateMemberRoleDto, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    const [updated] = await this.db
      .update(organizationMembers)
      .set({ role: dto.role })
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, targetUserId)))
      .returning();
    if (!updated) throw new AppException(ErrorCode.ORG_NOT_FOUND, 'Member not found', 404);
    return updated;
  }

  async removeMember(orgId: string, targetUserId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    await this.db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, targetUserId)));
  }

  async invite(orgId: string, dto: InviteMemberDto, invitedBy: string) {
    await this.requireMinRole(orgId, invitedBy, ['owner', 'admin']);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [invitation] = await this.db
      .insert(organizationInvitations)
      .values({ organizationId: orgId, email: dto.email, role: dto.role ?? 'member', token, invitedBy, expiresAt })
      .returning();
    return invitation;
  }

  async listInvitations(orgId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    return this.db.select().from(organizationInvitations).where(eq(organizationInvitations.organizationId, orgId));
  }

  async acceptInvitation(token: string, userId: string) {
    const [invitation] = await this.db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token));
    if (!invitation) throw new AppException(ErrorCode.ORG_INVITATION_NOT_FOUND, 'Invitation not found', 404);
    if (invitation.expiresAt < new Date()) throw new AppException(ErrorCode.ORG_INVITATION_EXPIRED, 'Invitation expired', 410);
    if (invitation.acceptedAt) throw new AppException(ErrorCode.ORG_ALREADY_MEMBER, 'Already accepted', 409);
    return this.db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values({ organizationId: invitation.organizationId, userId, role: invitation.role });
      await tx.update(organizationInvitations).set({ acceptedAt: new Date() }).where(eq(organizationInvitations.token, token));
    });
  }

  async revokeInvitation(orgId: string, invitationId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    await this.db
      .delete(organizationInvitations)
      .where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.organizationId, orgId)));
  }

  private async requireMinRole(orgId: string, userId: string, allowedRoles: string[]) {
    const [member] = await this.db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)));
    if (!member || !allowedRoles.includes(member.role)) {
      throw new AppException(ErrorCode.ORG_FORBIDDEN, 'Insufficient organization permissions', 403);
    }
    return member;
  }
}
`,
  );

  // Controller
  write(
    src('organizations/organizations.controller.ts'),
    `import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List my organizations' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization' })
  findOne(@Param('orgId') orgId: string) {
    return this.organizationsService.findOne(orgId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization (owner/admin)' })
  update(@Param('orgId') orgId: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.update(orgId, dto, user.id);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization (owner)' })
  remove(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.remove(orgId, user.id);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List members' })
  listMembers(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.listMembers(orgId, user.id);
  }

  @Patch(':orgId/members/:userId/role')
  @ApiOperation({ summary: 'Update member role (owner/admin)' })
  updateMemberRole(@Param('orgId') orgId: string, @Param('userId') userId: string, @Body() dto: UpdateMemberRoleDto, @CurrentUser() requester: { id: string }) {
    return this.organizationsService.updateMemberRole(orgId, userId, dto, requester.id);
  }

  @Delete(':orgId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member (owner/admin)' })
  removeMember(@Param('orgId') orgId: string, @Param('userId') userId: string, @CurrentUser() requester: { id: string }) {
    return this.organizationsService.removeMember(orgId, userId, requester.id);
  }

  @Post(':orgId/invitations')
  @ApiOperation({ summary: 'Invite by email (owner/admin)' })
  invite(@Param('orgId') orgId: string, @Body() dto: InviteMemberDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.invite(orgId, dto, user.id);
  }

  @Get(':orgId/invitations')
  @ApiOperation({ summary: 'List invitations (owner/admin)' })
  listInvitations(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.listInvitations(orgId, user.id);
  }

  @Post('invitations/:token/accept')
  @Public()
  @ApiOperation({ summary: 'Accept invitation by token' })
  acceptInvitation(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.acceptInvitation(token, user.id);
  }

  @Delete(':orgId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke invitation (owner/admin)' })
  revokeInvitation(@Param('orgId') orgId: string, @Param('invitationId') invitationId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.revokeInvitation(orgId, invitationId, user.id);
  }
}
`,
  );

  // Module
  write(
    src('organizations/organizations.module.ts'),
    `import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
`,
  );

  // Patch enums
  patchFile(
    src('database/schema/enums.ts'),
    "export const todoPriorityEnum = pgEnum('todo_priority', ['low', 'medium', 'high']);",
    "\nexport const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member', 'viewer']);",
  );

  // Patch schema index
  patchFile(
    src('database/schema/index.ts'),
    "export * from './payments.schema';",
    "export * from './organizations.schema';",
  );

  // Patch error codes
  patchFile(
    src('common/errors/error-codes.ts'),
    '  // General',
    `  // Organizations
  ORG_NOT_FOUND = 'ORG_NOT_FOUND',
  ORG_FORBIDDEN = 'ORG_FORBIDDEN',
  ORG_ALREADY_MEMBER = 'ORG_ALREADY_MEMBER',
  ORG_INVITATION_NOT_FOUND = 'ORG_INVITATION_NOT_FOUND',
  ORG_INVITATION_EXPIRED = 'ORG_INVITATION_EXPIRED',
`,
    'before',
  );

  // Patch app.module.ts — import line
  patchFile(
    src('../src/app.module.ts'),
    "import { PaymentsModule } from './payments/payments.module';",
    "import { OrganizationsModule } from './organizations/organizations.module';",
  );

  // Patch app.module.ts — imports array
  patchFile(src('../src/app.module.ts'), '    PaymentsModule,', '    OrganizationsModule,');

  console.log('\n  Running db:generate…');
  execSync('bun run db:generate', { stdio: 'inherit', cwd: ROOT });
}

// ─── Feature Flags ───────────────────────────────────────────────────────────

function installFeatureFlags() {
  // Schema
  write(
    src('database/schema/feature-flags.schema.ts'),
    `import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().default(sql\`gen_random_uuid()\`),
  key: varchar('key', { length: 128 }).notNull().unique(),
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').notNull().default(100),
  conditions: jsonb('conditions').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
`,
  );

  // DTOs
  write(
    src('feature-flags/dto/create-feature-flag.dto.ts'),
    `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'new-dashboard' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-_]+$/, { message: 'key must be lowercase alphanumeric with dashes/underscores' })
  key: string;

  @ApiProperty({ example: 'New Dashboard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 100, description: 'Rollout percentage 0–100' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  conditions?: Record<string, unknown>;
}
`,
  );

  write(
    src('feature-flags/dto/update-feature-flag.dto.ts'),
    `import { PartialType } from '@nestjs/swagger';
import { CreateFeatureFlagDto } from './create-feature-flag.dto';

export class UpdateFeatureFlagDto extends PartialType(CreateFeatureFlagDto) {}
`,
  );

  // Service
  write(
    src('feature-flags/feature-flags.service.ts'),
    `import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { featureFlags } from '../database/schema';
import type { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import type { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateFeatureFlagDto) {
    const [flag] = await this.db
      .insert(featureFlags)
      .values({ key: dto.key, name: dto.name, description: dto.description, enabled: dto.enabled ?? false, rolloutPercentage: dto.rolloutPercentage ?? 100, conditions: dto.conditions })
      .returning();
    return flag;
  }

  async findAll() {
    return this.db.select().from(featureFlags).orderBy(featureFlags.key);
  }

  async findByKey(key: string) {
    const [flag] = await this.db.select().from(featureFlags).where(eq(featureFlags.key, key));
    if (!flag) throw new NotFoundException(\`Feature flag '\${key}' not found\`);
    return flag;
  }

  async update(key: string, dto: UpdateFeatureFlagDto) {
    await this.findByKey(key);
    const [updated] = await this.db
      .update(featureFlags)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();
    return updated;
  }

  async remove(key: string) {
    await this.findByKey(key);
    await this.db.delete(featureFlags).where(eq(featureFlags.key, key));
  }

  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const [flag] = await this.db.select().from(featureFlags).where(eq(featureFlags.key, key));
    if (!flag || !flag.enabled) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;
    if (userId) return simpleHash(\`\${key}:\${userId}\`) % 100 < flag.rolloutPercentage;
    return false;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
`,
  );

  // Decorator + Guard
  write(
    src('feature-flags/feature-flags.decorator.ts'),
    `import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'feature_flag';
export const RequireFeatureFlag = (flag: string) => SetMetadata(FEATURE_FLAG_KEY, flag);
`,
  );

  write(
    src('feature-flags/feature-flags.guard.ts'),
    `import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { FEATURE_FLAG_KEY } from './feature-flags.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!flagKey) return true;
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    const enabled = await this.featureFlagsService.isEnabled(flagKey, userId);
    if (!enabled) throw new AppException(ErrorCode.FEATURE_DISABLED, \`Feature '\${flagKey}' is not enabled\`, 403);
    return true;
  }
}
`,
  );

  // Controller
  write(
    src('feature-flags/feature-flags.controller.ts'),
    `import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create flag (admin)' })
  create(@Body() dto: CreateFeatureFlagDto) { return this.featureFlagsService.create(dto); }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all flags (admin)' })
  findAll() { return this.featureFlagsService.findAll(); }

  @Get(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Get flag by key (admin)' })
  findOne(@Param('key') key: string) { return this.featureFlagsService.findByKey(key); }

  @Get(':key/check')
  @Public()
  @ApiOperation({ summary: 'Check if flag is enabled for current user' })
  async check(@Param('key') key: string, @CurrentUser() user?: { id: string }) {
    return { key, enabled: await this.featureFlagsService.isEnabled(key, user?.id) };
  }

  @Patch(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Update flag (admin)' })
  update(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) { return this.featureFlagsService.update(key, dto); }

  @Delete(':key')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete flag (admin)' })
  remove(@Param('key') key: string) { return this.featureFlagsService.remove(key); }
}
`,
  );

  // Module
  write(
    src('feature-flags/feature-flags.module.ts'),
    `import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './feature-flags.guard';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
`,
  );

  // Patch schema index
  patchFile(
    src('database/schema/index.ts'),
    "export * from './payments.schema';",
    "export * from './feature-flags.schema';",
  );

  // Patch error codes
  patchFile(
    src('common/errors/error-codes.ts'),
    '  // General',
    `  // Feature Flags
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  FEATURE_FLAG_NOT_FOUND = 'FEATURE_FLAG_NOT_FOUND',
`,
    'before',
  );

  // Patch app.module.ts
  patchFile(
    src('../src/app.module.ts'),
    "import { PaymentsModule } from './payments/payments.module';",
    "import { FeatureFlagsModule } from './feature-flags/feature-flags.module';",
  );

  patchFile(src('../src/app.module.ts'), '    PaymentsModule,', '    FeatureFlagsModule,');

  console.log('\n  Running db:generate…');
  execSync('bun run db:generate', { stdio: 'inherit', cwd: ROOT });
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   NestJS Boilerplate — Add Feature   ║');
  console.log('╚══════════════════════════════════════╝\n');

  const available = Object.values(FEATURES);

  available.forEach((f, i) => {
    const installed = alreadyInstalled(f.checkPath);
    const status = installed ? ' [installed]' : '';
    console.log(`  ${i + 1}. ${f.name}${status}`);
    console.log(`     ${f.description}\n`);
  });

  const raw = await ask('Which features? (comma-separated numbers, or "all"): ');
  rl.close();

  const input = raw.trim().toLowerCase();
  let selected: Feature[];

  if (input === 'all') {
    selected = available;
  } else {
    const indices = input
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10) - 1)
      .filter((i) => i >= 0 && i < available.length);
    selected = indices.map((i) => available[i]);
  }

  if (!selected.length) {
    console.log('\nNo valid selection. Exiting.');
    process.exit(0);
  }

  for (const feature of selected) {
    if (alreadyInstalled(feature.checkPath)) {
      console.log(`\n⊘  ${feature.name} already installed — skipping`);
      continue;
    }
    console.log(`\n▶  Installing ${feature.name}…`);
    feature.install();
    console.log(`✓  ${feature.name} installed`);
  }

  console.log('\nDone. Next steps:');
  console.log('  bun run db:migrate    # apply migrations to your DB');
  console.log('  bun run typecheck     # verify no type errors\n');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  rl.close();
  process.exit(1);
});
