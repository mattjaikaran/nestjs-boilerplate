import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateOrganizationDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.findOne(orgId, userId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization (owner/admin only)' })
  update(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.service.update(orgId, userId, dto);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization (owner only, soft delete)' })
  remove(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.remove(orgId, userId);
  }

  // ─── Members ────────────────────────────────────────────────────────────────

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  listMembers(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.listMembers(orgId, userId);
  }

  @Patch(':orgId/members/:targetUserId/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update member role (owner/admin only)' })
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.service.updateMemberRole(orgId, targetUserId, requesterId, dto.role);
  }

  @Delete(':orgId/members/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the organization (owner/admin only)' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.service.removeMember(orgId, targetUserId, requesterId);
  }

  // ─── Invitations ────────────────────────────────────────────────────────────

  @Post(':orgId/invitations')
  @ApiOperation({ summary: 'Invite a user to the organization by email (owner/admin only)' })
  invite(
    @Param('orgId') orgId: string,
    @CurrentUser('id') invitedById: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.service.invite(orgId, invitedById, dto);
  }

  @Delete(':orgId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending invitation (owner/admin only)' })
  revokeInvitation(
    @Param('orgId') _orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.service.revokeInvitation(invitationId, requesterId);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept an invitation by token' })
  acceptInvitation(@Param('token') token: string, @CurrentUser('id') userId: string) {
    return this.service.acceptInvitation(token, userId);
  }
}
