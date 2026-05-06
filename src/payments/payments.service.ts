import { BadRequestException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { Stripe as StripeNS } from 'stripe/cjs/stripe.core';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { payments, subscriptions } from '../database/schema/payments.schema';
import type { User } from '../database/schema/users.schema';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(
    private config: ConfigService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('stripe.secretKey'), {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    const existing = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      columns: { stripeCustomerId: true },
    });

    if (existing) return existing.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user.id },
    });

    return customer.id;
  }

  async createCheckoutSession(user: User, dto: CreateCheckoutSessionDto): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(user);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: dto.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: dto.successUrl ?? this.config.get<string>('stripe.successUrl'),
      cancel_url: dto.cancelUrl ?? this.config.get<string>('stripe.cancelUrl'),
      metadata: { userId: user.id },
    });

    if (!session.url) throw new BadRequestException('Failed to create checkout session');

    return { url: session.url };
  }

  async createBillingPortalSession(user: User, returnUrl?: string): Promise<{ url: string }> {
    const sub = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!sub)
      throw new AppException(
        ErrorCode.PAYMENT_SUBSCRIPTION_NOT_FOUND,
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl ?? this.config.get<string>('stripe.successUrl'),
    });

    return { url: session.url };
  }

  async getSubscription(userId: string) {
    return this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
  }

  async getPaymentHistory(userId: string) {
    return this.db.query.payments.findMany({
      where: eq(payments.userId, userId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    const webhookSecret = this.config.getOrThrow<string>('stripe.webhookSecret');

    let event: StripeNS.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as StripeNS.Checkout.Session);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.upsertSubscription(event.data.object as StripeNS.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as StripeNS.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as StripeNS.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as StripeNS.Invoice);
          break;
        default:
          this.logger.debug(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed processing Stripe event ${event.type}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async handleCheckoutCompleted(session: StripeNS.Checkout.Session): Promise<void> {
    if (!session.subscription) return;

    const sub = await this.stripe.subscriptions.retrieve(session.subscription as string);
    await this.upsertSubscription(sub);
  }

  private async upsertSubscription(sub: StripeNS.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) {
      this.logger.warn(`Subscription ${sub.id} has no userId in metadata`);
      return;
    }

    const item = sub.items.data[0];
    if (!item) return;

    const values = {
      userId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      stripePriceId: item.price.id,
      stripeProductId: item.price.product as string,
      status: sub.status as never,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end ? 1 : 0,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      updatedAt: new Date(),
    };

    await this.db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: { ...values },
      });
  }

  private async handleSubscriptionDeleted(sub: StripeNS.Subscription): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  }

  private async handleInvoicePaymentSucceeded(invoice: StripeNS.Invoice): Promise<void> {
    const userId = invoice.parent?.subscription_details?.metadata?.userId;
    if (!userId) {
      this.logger.warn(`Invoice ${invoice.id} has no userId in metadata — payment record skipped`);
      return;
    }

    const paymentIntentId = (() => {
      const pi = invoice.payments?.data[0]?.payment.payment_intent;
      return typeof pi === 'string' ? pi : pi?.id;
    })();

    await this.db.insert(payments).values({
      userId,
      stripeCustomerId: invoice.customer as string,
      stripePaymentIntentId: paymentIntentId,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      description: invoice.description ?? `Invoice ${invoice.number}`,
    });
  }

  private async handleInvoicePaymentFailed(invoice: StripeNS.Invoice): Promise<void> {
    const userId = invoice.parent?.subscription_details?.metadata?.userId;
    if (!userId) {
      this.logger.warn(
        `Invoice ${invoice.id} has no userId in metadata — failed payment record skipped`,
      );
      return;
    }

    const paymentIntentId = (() => {
      const pi = invoice.payments?.data[0]?.payment.payment_intent;
      return typeof pi === 'string' ? pi : pi?.id;
    })();

    await this.db.insert(payments).values({
      userId,
      stripeCustomerId: invoice.customer as string,
      stripePaymentIntentId: paymentIntentId,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      description: invoice.description ?? `Invoice ${invoice.number}`,
    });
  }
}
