import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { featureFlags } from '../database/schema';
import type { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import type { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateFeatureFlagDto) {
    const [flag] = await this.db
      .insert(featureFlags)
      .values({
        key: dto.key,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 100,
        conditions: dto.conditions,
      })
      .returning();
    return flag;
  }

  async findAll() {
    return this.db.select().from(featureFlags).orderBy(featureFlags.key);
  }

  async findByKey(key: string) {
    const [flag] = await this.db.select().from(featureFlags).where(eq(featureFlags.key, key));
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
    return flag;
  }

  async update(key: string, dto: UpdateFeatureFlagDto) {
    await this.findByKey(key);
    const [updated] = await this.db
      .update(featureFlags)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();
    return updated;
  }

  async remove(key: string) {
    await this.findByKey(key);
    await this.db.delete(featureFlags).where(eq(featureFlags.key, key));
  }

  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const [flag] = await this.db.select().from(featureFlags).where(eq(featureFlags.key, key));
    if (!flag || !flag.enabled) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;

    // Deterministic user-based rollout: hash userId into a bucket 0–99
    if (userId) {
      const bucket = simpleHash(`${key}:${userId}`) % 100;
      return bucket < flag.rolloutPercentage;
    }

    return false;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
