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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  CheckoutSessionResponseDto,
  ErrorResponseDto,
  PaymentHistoryItemDto,
  PortalSessionResponseDto,
  SubscriptionResponseDto,
  WebhookReceivedResponseDto,
} from '../common/dto/swagger.dto';
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
  @ApiResponse({
    status: 201,
    description: 'Checkout session created',
    type: CheckoutSessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Failed to create session', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  createCheckoutSession(@CurrentUser() user: User, @Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(user, dto);
  }

  @Post('portal')
  @Permissions('payments:write')
  @ApiOperation({ summary: 'Create a Stripe Billing Portal session' })
  @ApiResponse({
    status: 201,
    description: 'Portal session created',
    type: PortalSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'No active subscription', type: ErrorResponseDto })
  createPortalSession(@CurrentUser() user: User, @Body() dto: CreatePortalSessionDto) {
    return this.paymentsService.createBillingPortalSession(user, dto.returnUrl);
  }

  @Get('subscription')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Get current user subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription details', type: SubscriptionResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  getSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSubscription(userId);
  }

  @Get('history')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Get payment history for current user' })
  @ApiResponse({ status: 200, description: 'Payment history', type: [PaymentHistoryItemDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  getPaymentHistory(@CurrentUser('id') userId: string) {
    return this.paymentsService.getPaymentHistory(userId);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (public)' })
  @ApiResponse({ status: 200, description: 'Webhook received', type: WebhookReceivedResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature', type: ErrorResponseDto })
  async handleWebhook(@Req() req: RawBodyRequest<FastifyRequest>) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
    await this.paymentsService.handleWebhook(signature, rawBody);
    return { received: true };
  }
}
