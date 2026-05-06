import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../database/drizzle.module';
import type { Todo } from '../database/schema';
import { TodosService } from './todos.service';

const mockTodo: Todo = {
  id: 'todo-id-1',
  title: 'Test Todo',
  description: 'A test todo',
  status: 'pending',
  priority: 'medium',
  isCompleted: false,
  completedAt: null,
  dueDate: null,
  tags: null,
  userId: 'user-id-1',
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

function buildSelectChain(result: unknown[]) {
  const chain = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    orderBy: jest.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.offset.mockResolvedValue(result);
  chain.limit.mockResolvedValue(result);
  return chain;
}

function buildInsertChain(result: unknown[]) {
  const chain = { values: jest.fn(), returning: jest.fn() };
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(result);
  return chain;
}

function buildUpdateChain(result: unknown[]) {
  const chain = { set: jest.fn(), where: jest.fn(), returning: jest.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(result);
  return chain;
}

describe('TodosService', () => {
  let service: TodosService;
  let mockDb: { select: jest.Mock; insert: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [TodosService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get(TodosService);
  });

  describe('create', () => {
    it('inserts and returns new todo', async () => {
      mockDb.insert.mockReturnValue(buildInsertChain([mockTodo]));

      const result = await service.create('user-id-1', {
        title: 'Test Todo',
        description: 'A test todo',
        priority: 'medium',
      });

      expect(result).toEqual(mockTodo);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns todo for correct user', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mockTodo]));
      const result = await service.findOne('todo-id-1', 'user-id-1');
      expect(result).toEqual(mockTodo);
    });

    it('throws NotFoundException when todo does not exist', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      await expect(service.findOne('bad-id', 'user-id-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when todo belongs to different user', async () => {
      const otherUserTodo = { ...mockTodo, userId: 'other-user-id' };
      mockDb.select.mockReturnValue(buildSelectChain([otherUserTodo]));
      await expect(service.findOne('todo-id-1', 'user-id-1')).rejects.toThrow(ForbiddenException);
    });
  });

  function buildFindAllMocks(data: unknown[], total: number) {
    const dataChain = {
      from: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn().mockResolvedValue(data),
    };
    dataChain.from.mockReturnValue(dataChain);
    dataChain.where.mockReturnValue(dataChain);
    dataChain.orderBy.mockReturnValue(dataChain);
    dataChain.limit.mockReturnValue(dataChain);

    const countChain = {
      from: jest.fn(),
      where: jest.fn().mockResolvedValue([{ total }]),
    };
    countChain.from.mockReturnValue(countChain);

    return { dataChain, countChain };
  }

  describe('findAll', () => {
    it('returns paginated todos with meta', async () => {
      const { dataChain, countChain } = buildFindAllMocks([mockTodo], 1);
      mockDb.select.mockReturnValueOnce(dataChain).mockReturnValueOnce(countChain);

      const result = await service.findAll('user-id-1', { page: 1, limit: 20 });

      expect(result.data).toEqual([mockTodo]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('calculates correct pagination meta', async () => {
      const { dataChain, countChain } = buildFindAllMocks(Array(10).fill(mockTodo), 25);
      mockDb.select.mockReturnValueOnce(dataChain).mockReturnValueOnce(countChain);

      const result = await service.findAll('user-id-1', { page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });
  });

  describe('update', () => {
    it('updates and returns modified todo', async () => {
      const updated = { ...mockTodo, title: 'Updated Title' };
      mockDb.select.mockReturnValue(buildSelectChain([mockTodo]));
      mockDb.update.mockReturnValue(buildUpdateChain([updated]));

      const result = await service.update('todo-id-1', 'user-id-1', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('sets completedAt when marking as completed', async () => {
      const completedTodo = {
        ...mockTodo,
        isCompleted: true,
        completedAt: new Date(),
        status: 'completed' as const,
      };
      mockDb.select.mockReturnValue(buildSelectChain([mockTodo]));
      mockDb.update.mockReturnValue(buildUpdateChain([completedTodo]));

      const result = await service.update('todo-id-1', 'user-id-1', { isCompleted: true });
      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).not.toBeNull();
    });

    it('throws NotFoundException when todo not found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      await expect(service.update('bad-id', 'user-id-1', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes the todo', async () => {
      const updateChain = buildUpdateChain([]);
      mockDb.select.mockReturnValue(buildSelectChain([mockTodo]));
      mockDb.update.mockReturnValue(updateChain);

      await service.remove('todo-id-1', 'user-id-1');
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws when todo does not exist', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      await expect(service.remove('bad-id', 'user-id-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('stats', () => {
    it('returns aggregated counts', async () => {
      const statsResult = [{ total: 10, completed: 4, pending: 5, inProgress: 1 }];
      const statsChain = {
        from: jest.fn(),
        where: jest.fn().mockResolvedValue(statsResult),
      };
      statsChain.from.mockReturnValue(statsChain);
      mockDb.select.mockReturnValue(statsChain);

      const result = await service.stats('user-id-1');
      expect(result).toEqual(statsResult[0]);
    });
  });
});
