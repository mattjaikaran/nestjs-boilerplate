import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Overrides the default ThrottlerGuard tracker to use the client IP address
 * rather than the NestJS user-context key. This gives true per-IP rate limiting
 * regardless of authentication state, which is critical for auth endpoints.
 *
 * Uses Fastify's req.ip which already respects the trustProxy setting set in main.ts.
 */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = (req as { ip?: string }).ip;
    if (ip) return ip;

    const xff = (req as { headers?: Record<string, string | string[] | undefined> }).headers?.[
      'x-forwarded-for'
    ];
    if (xff) return (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();

    return 'unknown';
  }

  protected async getErrorMessage(_context: ExecutionContext): Promise<string> {
    return 'Too many requests from this IP. Please try again later.';
  }
}
