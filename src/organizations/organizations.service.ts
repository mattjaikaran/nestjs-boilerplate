import * as crypto from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import {
  type OrgMemberRole,
  type Organization,
  type OrganizationMember,
  invitations,
  organizationMembers,
  organizations,
} from '../database/schema';
import type {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(ownerId: string, dto: CreateOrganizationDto): Promise<Organization> {
    const existing = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, dto.slug))
      .limit(1);

    if (existing.length)
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        `Slug "${dto.slug}" is already taken`,
        HttpStatus.CONFLICT,
      );

    const [org] = await this.db
      .insert(organizations)
      .values({ ...dto, ownerId })
      .returning();

    // Owner is automatically a member with owner role
    await this.db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: ownerId,
      role: 'owner',
    });

    this.eventEmitter.emit('organization.created', { orgId: org.id, ownerId });
    return org;
  }

  async findAll(userId: string): Promise<Organization[]> {
    const memberships = await this.db
      .select({ orgId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    if (!memberships.length) return [];

    const orgIds = memberships.map((m) => m.orgId);

    return this.db
      .select()
      .from(organizations)
      .where(and(isNull(organizations.deletedAt), inArray(organizations.id, orgIds)));
  }

  async findOne(orgId: string, userId: string): Promise<Organization> {
    await this.requireMember(orgId, userId);
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .limit(1);

    if (!org)
      throw new AppException(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    return org;
  }

  async update(orgId: string, userId: string, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.requireRole(orgId, userId, ['owner', 'admin']);
    const [updated] = await this.db
      .update(organizations)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .returning();

    if (!updated)
      throw new AppException(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    return updated;
  }

  async remove(orgId: string, userId: string): Promise<void> {
    await this.requireRole(orgId, userId, ['owner']);
    await this.db
      .update(organizations)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(organizations.id, orgId));
  }

  // ─── Members ────────────────────────────────────────────────────────────────

  async listMembers(orgId: string, userId: string): Promise<OrganizationMember[]> {
    await this.requireMember(orgId, userId);
    return this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    requesterId: string,
    role: 'admin' | 'member',
  ): Promise<void> {
    await this.requireRole(orgId, requesterId, ['owner', 'admin']);

    const [target] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!target)
      throw new AppException(ErrorCode.NOT_FOUND, 'Member not found', HttpStatus.NOT_FOUND);
    if (target.role === 'owner')
      throw new AppException(ErrorCode.FORBIDDEN, 'Cannot change owner role', HttpStatus.FORBIDDEN);

    await this.db
      .update(organizationMembers)
      .set({ role })
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      );
  }

  async removeMember(orgId: string, targetUserId: string, requesterId: string): Promise<void> {
    await this.requireRole(orgId, requesterId, ['owner', 'admin']);
    const [target] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!target)
      throw new AppException(ErrorCode.NOT_FOUND, 'Member not found', HttpStatus.NOT_FOUND);
    if (target.role === 'owner')
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Cannot remove the organization owner',
        HttpStatus.FORBIDDEN,
      );

    await this.db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      );
  }

  // ─── Invitations ────────────────────────────────────────────────────────────

  async invite(orgId: string, invitedById: string, dto: InviteMemberDto) {
    await this.requireRole(orgId, invitedById, ['owner', 'admin']);

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await this.db
      .insert(invitations)
      .values({
        organizationId: orgId,
        email: dto.email,
        role: dto.role,
        token,
        invitedById,
        expiresAt,
      })
      .returning();

    const [org] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const appUrl = this.config.get('APP_URL', 'http://localhost:3000');

    this.eventEmitter.emit('invitation.created', {
      invitationId: invite.id,
      email: dto.email,
      orgName: org?.name,
      inviteUrl: `${appUrl}/invitations/${token}`,
    });

    return invite;
  }

  async acceptInvitation(token: string, userId: string): Promise<Organization> {
    const [invite] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite || invite.status !== 'pending')
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Invalid or expired invitation',
        HttpStatus.BAD_REQUEST,
      );

    if (invite.expiresAt < new Date()) {
      await this.db
        .update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invite.id));
      throw new AppException(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Invitation has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Add user to org
    await this.db
      .insert(organizationMembers)
      .values({ organizationId: invite.organizationId, userId, role: invite.role })
      .onConflictDoNothing();

    await this.db
      .update(invitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invite.organizationId))
      .limit(1);

    if (!org)
      throw new AppException(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    return org;
  }

  async revokeInvitation(invitationId: string, requesterId: string): Promise<void> {
    const [invite] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invite)
      throw new AppException(ErrorCode.NOT_FOUND, 'Invitation not found', HttpStatus.NOT_FOUND);

    await this.requireRole(invite.organizationId, requesterId, ['owner', 'admin']);
    await this.db
      .update(invitations)
      .set({ status: 'revoked' })
      .where(eq(invitations.id, invitationId));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async requireMember(orgId: string, userId: string): Promise<OrganizationMember> {
    const [member] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)),
      )
      .limit(1);

    if (!member)
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'You are not a member of this organization',
        HttpStatus.FORBIDDEN,
      );

    return member;
  }

  private async requireRole(orgId: string, userId: string, roles: OrgMemberRole[]): Promise<void> {
    const member = await this.requireMember(orgId, userId);
    if (!roles.includes(member.role))
      throw new AppException(ErrorCode.FORBIDDEN, 'Insufficient role', HttpStatus.FORBIDDEN);
  }
}
