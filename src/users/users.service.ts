import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { PaginationDto } from '../common/dto/pagination.dto';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type NewUser, type User, users } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(data: NewUser): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  }

  async findByProviderId(provider: string, providerId: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.provider, provider as User['provider']),
          eq(users.providerId, providerId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return user ?? null;
  }

  async findAll(dto: PaginationDto): Promise<{ data: User[]; total: number }> {
    const { page = 1, limit = 20, search } = dto;
    const offset = (page - 1) * limit;

    const conditions = [isNull(users.deletedAt)];
    if (search) {
      conditions.push(ilike(users.email, `%${search}%`));
    }

    const [data, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(and(...conditions))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(...conditions)),
    ]);

    return { data, total: count };
  }

  async update(id: string, data: Partial<NewUser>): Promise<User> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }
}
