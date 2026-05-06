import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type ApiKey, apiKeys } from '../database/schema';

export interface CreateApiKeyResult {
  id: string;
  name: string;
  key: string;
  prefix: string;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeyService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(userId: string, name: string, expiresAt?: Date): Promise<CreateApiKeyResult> {
    const rawKey = randomBytes(32).toString('hex');
    const prefix = `sk_${rawKey.slice(0, 8)}`;
    const keyHash = this.hash(rawKey);
    const fullKey = `${prefix}_${rawKey}`;

    const [apiKey] = await this.db
      .insert(apiKeys)
      .values({ name, keyHash, prefix, userId, expiresAt: expiresAt ?? null })
      .returning();

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey,
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  async findAllForUser(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));

    return rows.map(({ keyHash: _, ...rest }) => rest);
  }

  async revoke(id: string, userId: string): Promise<void> {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (!key) throw new NotFoundException('API key not found');

    await this.db
      .update(apiKeys)
      .set({ isActive: false, revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ isActive: false, revokedAt: new Date() })
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  }

  async validate(rawKey: string): Promise<ApiKey | null> {
    const keyHash = this.hash(rawKey.split('_').slice(2).join('_') || rawKey);

    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.revokedAt),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
        ),
      )
      .limit(1);

    if (!key) return null;

    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

    return key;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
