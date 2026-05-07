import { Controller, Get, Query, Version } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { and, asc, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { todos } from '../../database/schema';

export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous page (base64-encoded)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Full-text search on title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}

export class CursorPageMeta {
  @ApiProperty({
    nullable: true,
    description: 'Pass as ?cursor= on next request; null when no more pages',
  })
  nextCursor: string | null;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  limit: number;
}

@ApiTags('Todos v2')
@ApiBearerAuth()
@Controller({ path: 'todos', version: '2' })
export class TodosV2Controller {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @Version('2')
  @ApiOperation({
    summary: 'List todos with cursor-based pagination (v2)',
    description:
      'Uses keyset / cursor pagination instead of offset-based. Pass the returned nextCursor as ?cursor= on subsequent requests. Stable under concurrent inserts.',
  })
  async findAll(@CurrentUser('id') userId: string, @Query() query: CursorPaginationDto) {
    const { cursor, limit = 20, search, order = 'desc' } = query;

    const decodedCursor = cursor ? decodeCursor(cursor) : null;

    const conditions = [eq(todos.userId, userId), isNull(todos.deletedAt)];

    if (search) {
      conditions.push(sql`${todos.title} ilike ${`%${search}%`}`);
    }

    if (decodedCursor) {
      const cmp = order === 'desc' ? lt : gt;
      conditions.push(cmp(todos.createdAt, decodedCursor.createdAt));
    }

    const orderFn = order === 'desc' ? desc : asc;

    const rows = await this.db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(orderFn(todos.createdAt))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];

    const nextCursor =
      hasNextPage && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

    return {
      data,
      meta: { nextCursor, hasNextPage, limit } satisfies CursorPageMeta,
    };
  }
}

interface CursorPayload {
  createdAt: Date;
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify({ c: payload.createdAt, i: payload.id })).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  const { c, i } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    c: string;
    i: string;
  };
  return { createdAt: new Date(c), id: i };
}
