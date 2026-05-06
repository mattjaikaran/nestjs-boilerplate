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

  // ─── Organizations ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations I belong to' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('orgId') orgId: string) {
    return this.organizationsService.findOne(orgId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization (owner/admin)' })
  update(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.update(orgId, dto, user.id);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete organization (owner)' })
  remove(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.remove(orgId, user.id);
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  listMembers(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.listMembers(orgId, user.id);
  }

  @Patch(':orgId/members/:userId/role')
  @ApiOperation({ summary: 'Update member role (owner/admin)' })
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() requester: { id: string },
  ) {
    return this.organizationsService.updateMemberRole(orgId, userId, dto, requester.id);
  }

  @Delete(':orgId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member (owner/admin)' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: { id: string },
  ) {
    return this.organizationsService.removeMember(orgId, userId, requester.id);
  }

  // ─── Invitations ──────────────────────────────────────────────────────────

  @Post(':orgId/invitations')
  @ApiOperation({ summary: 'Invite a user by email (owner/admin)' })
  invite(
    @Param('orgId') orgId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.invite(orgId, dto, user.id);
  }

  @Get(':orgId/invitations')
  @ApiOperation({ summary: 'List pending invitations (owner/admin)' })
  listInvitations(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.listInvitations(orgId, user.id);
  }

  @Post('invitations/:token/accept')
  @Public()
  @ApiOperation({ summary: 'Accept an invitation via token' })
  acceptInvitation(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.acceptInvitation(token, user.id);
  }

  @Delete(':orgId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invitation (owner/admin)' })
  revokeInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.revokeInvitation(orgId, invitationId, user.id);
  }
}
