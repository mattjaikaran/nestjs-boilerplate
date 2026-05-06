import { randomBytes } from 'node:crypto';
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

  // ─── Organizations ────────────────────────────────────────────────────────

  async create(dto: CreateOrganizationDto, ownerId: string) {
    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: dto.name,
          slug: dto.slug,
          plan: dto.plan ?? 'free',
          ownerId,
          settings: dto.settings,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: ownerId,
        role: 'owner',
      });

      return org;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.db
      .select({ org: organizations, role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(eq(organizationMembers.userId, userId), isNull(organizations.deletedAt)));
    return memberships;
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
    await this.db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(eq(organizations.id, orgId));
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  async listMembers(orgId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin', 'member', 'viewer']);
    return this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requesterId: string,
  ) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    const [updated] = await this.db
      .update(organizationMembers)
      .set({ role: dto.role })
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      )
      .returning();
    if (!updated) throw new AppException(ErrorCode.ORG_NOT_FOUND, 'Member not found', 404);
    return updated;
  }

  async removeMember(orgId: string, targetUserId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    await this.db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      );
  }

  // ─── Invitations ──────────────────────────────────────────────────────────

  async invite(orgId: string, dto: InviteMemberDto, invitedBy: string) {
    await this.requireMinRole(orgId, invitedBy, ['owner', 'admin']);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await this.db
      .insert(organizationInvitations)
      .values({
        organizationId: orgId,
        email: dto.email,
        role: dto.role ?? 'member',
        token,
        invitedBy,
        expiresAt,
      })
      .returning();
    return invitation;
  }

  async listInvitations(orgId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    return this.db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, orgId));
  }

  async acceptInvitation(token: string, userId: string) {
    const [invitation] = await this.db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token));

    if (!invitation) {
      throw new AppException(ErrorCode.ORG_INVITATION_NOT_FOUND, 'Invitation not found', 404);
    }
    if (invitation.expiresAt < new Date()) {
      throw new AppException(ErrorCode.ORG_INVITATION_EXPIRED, 'Invitation has expired', 410);
    }
    if (invitation.acceptedAt) {
      throw new AppException(ErrorCode.ORG_ALREADY_MEMBER, 'Invitation already accepted', 409);
    }

    return this.db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values({
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      });
      await tx
        .update(organizationInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(organizationInvitations.token, token));
    });
  }

  async revokeInvitation(orgId: string, invitationId: string, requesterId: string) {
    await this.requireMinRole(orgId, requesterId, ['owner', 'admin']);
    await this.db
      .delete(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.organizationId, orgId),
        ),
      );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async requireMinRole(orgId: string, userId: string, allowedRoles: string[]) {
    const [member] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)),
      );
    if (!member || !allowedRoles.includes(member.role)) {
      throw new AppException(ErrorCode.ORG_FORBIDDEN, 'Insufficient organization permissions', 403);
    }
    return member;
  }
}
