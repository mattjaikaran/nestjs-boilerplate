import { apiErrorSchema, apiSuccessSchema } from './api-response.contract';
import { authTokensContract, registerResponseSchema, userPublicContract } from './auth.contract';
import {
  todoContract,
  todoListContract,
  todoListResponseSchema,
  todoResponseSchema,
} from './todo.contract';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'user@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'user' as const,
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
};

const mockTodo = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Buy groceries',
  description: 'Milk, eggs',
  status: 'pending' as const,
  priority: 'medium' as const,
  isCompleted: false,
  dueDate: null,
  completedAt: null,
  tags: ['shopping'],
  userId: '550e8400-e29b-41d4-a716-446655440000',
  metadata: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const mockAuthTokens = {
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
  refreshToken: 'eyJhbGciOiJIUzI1NiJ9.refresh.sig',
  user: mockUser,
};

function wrap<T>(data: T) {
  return { success: true as const, data, timestamp: new Date().toISOString() };
}

// ─── API envelope ─────────────────────────────────────────────────────────────

describe('API response envelope contracts', () => {
  it('validates a success envelope', () => {
    const schema = apiSuccessSchema(todoContract);
    expect(() => schema.parse(wrap(mockTodo))).not.toThrow();
  });

  it('rejects a success envelope missing required fields', () => {
    const schema = apiSuccessSchema(todoContract);
    const result = schema.safeParse({ success: true, data: {} });
    expect(result.success).toBe(false);
  });

  it('validates an error envelope', () => {
    const payload = {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
      path: '/api/v1/todos/missing-id',
      method: 'GET',
      message: 'Todo not found',
    };
    expect(() => apiErrorSchema.parse(payload)).not.toThrow();
  });
});

// ─── Todo contracts ───────────────────────────────────────────────────────────

describe('Todo contracts', () => {
  it('validates a valid todo', () => {
    expect(() => todoContract.parse(mockTodo)).not.toThrow();
  });

  it('rejects a todo with invalid status', () => {
    const result = todoContract.safeParse({ ...mockTodo, status: 'done' });
    expect(result.success).toBe(false);
  });

  it('rejects a todo with invalid priority', () => {
    const result = todoContract.safeParse({ ...mockTodo, priority: 'urgent' });
    expect(result.success).toBe(false);
  });

  it('rejects a todo with empty title', () => {
    const result = todoContract.safeParse({ ...mockTodo, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a todo with non-UUID id', () => {
    const result = todoContract.safeParse({ ...mockTodo, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('validates a todo list envelope', () => {
    const list = {
      items: [mockTodo],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    expect(() => todoListContract.parse(list)).not.toThrow();
  });

  it('validates a wrapped todo API response', () => {
    expect(() => todoResponseSchema.parse(wrap(mockTodo))).not.toThrow();
  });

  it('validates a wrapped todo list API response', () => {
    const list = { items: [mockTodo], total: 1, page: 1, limit: 20, totalPages: 1 };
    expect(() => todoListResponseSchema.parse(wrap(list))).not.toThrow();
  });
});

// ─── Auth contracts ───────────────────────────────────────────────────────────

describe('Auth contracts', () => {
  it('validates a user public shape', () => {
    expect(() => userPublicContract.parse(mockUser)).not.toThrow();
  });

  it('rejects a user with invalid role', () => {
    const result = userPublicContract.safeParse({ ...mockUser, role: 'superadmin' });
    expect(result.success).toBe(false);
  });

  it('rejects a user with invalid email', () => {
    const result = userPublicContract.safeParse({ ...mockUser, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('validates auth tokens', () => {
    expect(() => authTokensContract.parse(mockAuthTokens)).not.toThrow();
  });

  it('rejects auth tokens with empty accessToken', () => {
    const result = authTokensContract.safeParse({ ...mockAuthTokens, accessToken: '' });
    expect(result.success).toBe(false);
  });

  it('validates a register response envelope', () => {
    expect(() => registerResponseSchema.parse(wrap(mockAuthTokens))).not.toThrow();
  });
});
