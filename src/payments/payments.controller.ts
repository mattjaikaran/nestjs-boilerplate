import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { User } from '../database/schema';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import type { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @Permissions('payments:write')
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a subscription' })
  createCheckoutSession(@CurrentUser() user: User, @Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(user, dto);
  }

  @Post('portal')
  @Permissions('payments:write')
  @ApiOperation({ summary: 'Create a Stripe Billing Portal session' })
  createPortalSession(@CurrentUser() user: User, @Body() dto: CreatePortalSessionDto) {
    return this.paymentsService.createBillingPortalSession(user, dto.returnUrl);
  }

  @Get('subscription')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Get current user subscription status' })
  getSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSubscription(userId);
  }

  @Get('history')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Get payment history for current user' })
  getPaymentHistory(@CurrentUser('id') userId: string) {
    return this.paymentsService.getPaymentHistory(userId);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (public)' })
  async handleWebhook(@Req() req: RawBodyRequest<FastifyRequest>) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
    await this.paymentsService.handleWebhook(signature, rawBody);
    return { received: true };
  }
}
