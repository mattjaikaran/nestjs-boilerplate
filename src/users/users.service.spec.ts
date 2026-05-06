import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../database/drizzle.module';
import type { User } from '../database/schema';
import { UsersService } from './users.service';

const mockUser: User = {
  id: 'user-id-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashed',
  role: 'user',
  provider: 'local',
  providerId: null,
  avatarUrl: null,
  isEmailVerified: true,
  isActive: true,
  isTotpEnabled: false,
  totpSecret: null,
  webauthnCredentials: null,
  lastLoginAt: null,
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

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: { select: jest.Mock; insert: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('create', () => {
    it('inserts and returns new user', async () => {
      mockDb.insert.mockReturnValue(buildInsertChain([mockUser]));

      const result = await service.create({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        provider: 'local',
      });

      expect(result).toEqual(mockUser);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mockUser]));
      const result = await service.findById('user-id-1');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns user when found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mockUser]));
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      const result = await service.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findByProviderId', () => {
    it('returns user when found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mockUser]));
      const result = await service.findByProviderId('google', 'google-123');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      const result = await service.findByProviderId('google', 'unknown');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns paginated users and total count', async () => {
      const usersResult = [mockUser];

      // First query: select().from().where().orderBy().limit().offset() — offset is terminal
      const dataChain = {
        from: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        offset: jest.fn().mockResolvedValue(usersResult),
      };
      dataChain.from.mockReturnValue(dataChain);
      dataChain.where.mockReturnValue(dataChain);
      dataChain.orderBy.mockReturnValue(dataChain);
      dataChain.limit.mockReturnValue(dataChain);

      // Second query: select({count}).from().where() — where is terminal
      const countChain = {
        from: jest.fn(),
        where: jest.fn().mockResolvedValue([{ count: 1 }]),
      };
      countChain.from.mockReturnValue(countChain);

      mockDb.select.mockReturnValueOnce(dataChain).mockReturnValueOnce(countChain);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual(usersResult);
      expect(result.total).toBe(1);
    });
  });

  describe('update', () => {
    it('updates and returns modified user', async () => {
      const updated = { ...mockUser, firstName: 'Updated' };
      mockDb.update.mockReturnValue(buildUpdateChain([updated]));

      const result = await service.update('user-id-1', { firstName: 'Updated' });
      expect(result.firstName).toBe('Updated');
    });

    it('throws NotFoundException when user not found', async () => {
      mockDb.update.mockReturnValue(buildUpdateChain([]));
      await expect(service.update('bad-id', { firstName: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLastLogin', () => {
    it('updates without throwing', async () => {
      const chain = { set: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([]) };
      mockDb.update.mockReturnValue(chain);

      await expect(service.updateLastLogin('user-id-1')).resolves.not.toThrow();
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt and deactivates user', async () => {
      const chain = { set: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([]) };
      mockDb.update.mockReturnValue(chain);

      await service.softDelete('user-id-1');
      expect(chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      );
    });
  });
});
