import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_SECONDS = 15 * 60;

@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  private attemptsKey(email: string) {
    return `lockout:attempts:${email.toLowerCase()}`;
  }

  private lockKey(email: string) {
    return `lockout:locked:${email.toLowerCase()}`;
  }

  async checkLocked(email: string): Promise<void> {
    try {
      const locked = await this.redis.get(this.lockKey(email));
      if (locked) {
        const ttl = await this.redis.ttl(this.lockKey(email));
        const minutes = Math.ceil(ttl / 60);
        throw new UnauthorizedException(
          `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minute(s).`,
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // Redis unavailable — fail open, log warning
      this.logger.warn('Redis unavailable for lockout check, proceeding without lockout');
    }
  }

  async recordFailure(email: string): Promise<void> {
    try {
      const key = this.attemptsKey(email);
      const attempts = await this.redis.incr(key);
      if (attempts === 1) {
        await this.redis.expire(key, WINDOW_SECONDS);
      }
      if (attempts >= MAX_ATTEMPTS) {
        await this.redis.setex(this.lockKey(email), LOCKOUT_SECONDS, '1');
        await this.redis.del(key);
        this.logger.warn(`Account locked after ${attempts} failed attempts: ${email}`);
      }
    } catch {
      this.logger.warn('Redis unavailable for failure recording');
    }
  }

  async clearFailures(email: string): Promise<void> {
    try {
      await this.redis.del(this.attemptsKey(email));
      await this.redis.del(this.lockKey(email));
    } catch {
      this.logger.warn('Redis unavailable for clearing failures');
    }
  }
}
