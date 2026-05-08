import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, isNull, lt, sql } from 'drizzle-orm';
import type { PaginatedResponse } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DRIZZLE, type DrizzleDB } from '../database/drizzle.module';
import { type NewTodo, type Todo, todos } from '../database/schema';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { TodoQueryDto } from './dto/todo-query.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';

type TodoResponse = Todo & { completed: boolean };

@Injectable()
export class TodosService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private mapResponse(todo: Todo): TodoResponse {
    return { ...todo, completed: todo.isCompleted };
  }

  async create(userId: string, dto: CreateTodoDto): Promise<TodoResponse> {
    const [todo] = await this.db
      .insert(todos)
      .values({
        ...dto,
        userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      } as NewTodo)
      .returning();
    return this.mapResponse(todo);
  }

  async findAll(userId: string, query: TodoQueryDto): Promise<PaginatedResponse<TodoResponse>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      priority,
      completed,
      overdue,
      due_today,
    } = query;
    const offset = (page - 1) * limit;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const conditions = [eq(todos.userId, userId), isNull(todos.deletedAt)];
    if (search) conditions.push(ilike(todos.title, `%${search}%`));
    if (priority) conditions.push(eq(todos.priority, priority));
    if (completed !== undefined) conditions.push(eq(todos.isCompleted, completed));
    if (overdue) {
      const overdueExpr = and(lt(todos.dueDate, now), eq(todos.isCompleted, false));
      if (overdueExpr) conditions.push(overdueExpr);
    }
    if (due_today) {
      const dueTodayExpr = and(gte(todos.dueDate, todayStart), lt(todos.dueDate, todayEnd));
      if (dueTodayExpr) conditions.push(dueTodayExpr);
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
      data: data.map((t) => this.mapResponse(t)),
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

  async findOne(id: string, userId: string): Promise<TodoResponse> {
    const [todo] = await this.db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), isNull(todos.deletedAt)))
      .limit(1);
    if (!todo)
      throw new AppException(ErrorCode.TODO_NOT_FOUND, 'Todo not found', HttpStatus.NOT_FOUND);
    if (todo.userId !== userId)
      throw new AppException(ErrorCode.TODO_FORBIDDEN, 'Forbidden', HttpStatus.FORBIDDEN);
    return this.mapResponse(todo);
  }

  async update(id: string, userId: string, dto: UpdateTodoDto): Promise<TodoResponse> {
    const todo = await this.findOne(id, userId);

    // Accept either `completed` or `isCompleted`
    const resolvedCompleted = dto.completed ?? dto.isCompleted;

    const updates: Partial<NewTodo> = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : todo.dueDate,
      updatedAt: new Date(),
    };

    if (resolvedCompleted !== undefined) {
      updates.isCompleted = resolvedCompleted;
      if (resolvedCompleted && !todo.isCompleted) {
        updates.completedAt = new Date();
        updates.status = 'completed';
      } else if (!resolvedCompleted && todo.isCompleted) {
        updates.completedAt = null;
        updates.status = 'pending';
      }
    }

    (updates as Record<string, unknown>).completed = undefined;

    const [updated] = await this.db.update(todos).set(updates).where(eq(todos.id, id)).returning();
    return this.mapResponse(updated);
  }

  async toggle(id: string, userId: string): Promise<TodoResponse> {
    const todo = await this.findOne(id, userId);
    const nowCompleted = !todo.isCompleted;

    const updates: Partial<NewTodo> = {
      isCompleted: nowCompleted,
      updatedAt: new Date(),
      completedAt: nowCompleted ? new Date() : null,
      status: nowCompleted ? 'completed' : 'pending',
    };

    const [updated] = await this.db.update(todos).set(updates).where(eq(todos.id, id)).returning();
    return this.mapResponse(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.db
      .update(todos)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(todos.id, id));
  }

  async bulkUpdate(userId: string, ids: string[], dto: UpdateTodoDto): Promise<TodoResponse[]> {
    const resolvedCompleted = dto.completed ?? dto.isCompleted;
    const patch: Partial<NewTodo> = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      updatedAt: new Date(),
    };

    if (resolvedCompleted !== undefined) {
      patch.isCompleted = resolvedCompleted;
      patch.completedAt = resolvedCompleted ? new Date() : null;
      patch.status = resolvedCompleted ? 'completed' : 'pending';
    }
    (patch as Record<string, unknown>).completed = undefined;

    const updated: TodoResponse[] = [];
    for (const id of ids) {
      const [existing] = await this.db
        .select()
        .from(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId), isNull(todos.deletedAt)))
        .limit(1);
      if (existing) {
        const [result] = await this.db.update(todos).set(patch).where(eq(todos.id, id)).returning();
        if (result) updated.push(this.mapResponse(result));
      }
    }
    return updated;
  }

  async bulkDelete(userId: string, ids: string[]): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    for (const id of ids) {
      const [todo] = await this.db
        .select()
        .from(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId), isNull(todos.deletedAt)))
        .limit(1);
      if (todo) {
        await this.db
          .update(todos)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(todos.id, id));
        deletedCount++;
      }
    }
    return { deletedCount };
  }

  async archiveCompleted(userId: string): Promise<{ message: string; archivedCount: number }> {
    const completed = await this.db
      .select({ id: todos.id })
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.isCompleted, true), isNull(todos.deletedAt)));

    if (completed.length === 0)
      return { message: 'No completed todos to archive', archivedCount: 0 };

    await this.db
      .update(todos)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(todos.userId, userId), eq(todos.isCompleted, true), isNull(todos.deletedAt)));

    return { message: 'Completed todos archived', archivedCount: completed.length };
  }

  async stats(userId: string) {
    const now = new Date();
    const conditions = and(eq(todos.userId, userId), isNull(todos.deletedAt));

    const [result] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where is_completed = true)::int`,
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
        overdue: sql<number>`count(*) filter (where due_date < ${now} and is_completed = false)::int`,
      })
      .from(todos)
      .where(conditions);

    const priorityRows = await this.db
      .select({
        priority: todos.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(todos)
      .where(conditions)
      .groupBy(todos.priority);

    const byPriority = priorityRows.reduce<Record<string, number>>((acc, row) => {
      if (row.priority) acc[row.priority] = row.count;
      return acc;
    }, {});

    return { ...result, byPriority };
  }
}
