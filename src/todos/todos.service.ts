import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { PaginatedResponse, PaginationDto } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type NewTodo, type Todo, todos } from '../database/schema';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const [todo] = await this.db
      .insert(todos)
      .values({
        ...dto,
        userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      } as NewTodo)
      .returning();
    return todo;
  }

  async findAll(userId: string, query: PaginationDto): Promise<PaginatedResponse<Todo>> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(todos.userId, userId), isNull(todos.deletedAt)];
    if (search) {
      conditions.push(ilike(todos.title, `%${search}%`));
    }

    const orderCol = todos[sortBy as keyof typeof todos] ?? todos.createdAt;
    const orderFn = sortOrder === 'ASC' ? asc : desc;

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(todos)
        .where(and(...conditions))
        .orderBy(orderFn(orderCol as never))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(todos)
        .where(and(...conditions)),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Todo> {
    const [todo] = await this.db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), isNull(todos.deletedAt)))
      .limit(1);
    if (!todo)
      throw new AppException(ErrorCode.TODO_NOT_FOUND, 'Todo not found', HttpStatus.NOT_FOUND);
    if (todo.userId !== userId)
      throw new AppException(ErrorCode.TODO_FORBIDDEN, 'Forbidden', HttpStatus.FORBIDDEN);
    return todo;
  }

  async update(id: string, userId: string, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findOne(id, userId);

    const updates: Partial<NewTodo> = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : todo.dueDate,
      updatedAt: new Date(),
    };

    if (dto.isCompleted && !todo.isCompleted) {
      updates.completedAt = new Date();
      updates.status = 'completed';
    } else if (dto.isCompleted === false && todo.isCompleted) {
      updates.completedAt = null;
    }

    const [updated] = await this.db.update(todos).set(updates).where(eq(todos.id, id)).returning();
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.db
      .update(todos)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(todos.id, id));
  }

  async stats(userId: string) {
    const conditions = and(eq(todos.userId, userId), isNull(todos.deletedAt));

    const [result] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where is_completed = true)::int`,
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      })
      .from(todos)
      .where(conditions);

    return result;
  }
}
