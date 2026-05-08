import { apiErrorSchema, apiSuccessSchema } from './api-response.contract';
import {
  authTokensContract,
  refreshResponseSchema,
  registerResponseSchema,
  userPublicContract,
} from './auth.contract';
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

  it('validates an error envelope with all required fields', () => {
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

  it('rejects an error envelope missing statusCode', () => {
    const result = apiErrorSchema.safeParse({
      errorCode: 'ERR',
      timestamp: new Date().toISOString(),
      path: '/',
      method: 'GET',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an error envelope missing errorCode', () => {
    const result = apiErrorSchema.safeParse({
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: '/',
      method: 'GET',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an error envelope missing path', () => {
    const result = apiErrorSchema.safeParse({
      statusCode: 500,
      errorCode: 'ERR',
      timestamp: new Date().toISOString(),
      method: 'GET',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an error envelope missing method', () => {
    const result = apiErrorSchema.safeParse({
      statusCode: 500,
      errorCode: 'ERR',
      timestamp: new Date().toISOString(),
      path: '/',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Todo contracts ───────────────────────────────────────────────────────────

describe('Todo contracts', () => {
  it('validates a valid todo', () => {
    expect(() => todoContract.parse(mockTodo)).not.toThrow();
  });

  it.each(['pending', 'in_progress', 'completed', 'cancelled'] as const)(
    'accepts status "%s"',
    (status) => {
      expect(() => todoContract.parse({ ...mockTodo, status })).not.toThrow();
    },
  );

  it('rejects a todo with invalid status', () => {
    expect(todoContract.safeParse({ ...mockTodo, status: 'done' }).success).toBe(false);
  });

  it.each(['low', 'medium', 'high'] as const)('accepts priority "%s"', (priority) => {
    expect(() => todoContract.parse({ ...mockTodo, priority })).not.toThrow();
  });

  it('rejects a todo with invalid priority', () => {
    expect(todoContract.safeParse({ ...mockTodo, priority: 'urgent' }).success).toBe(false);
  });

  it('rejects a todo with empty title', () => {
    expect(todoContract.safeParse({ ...mockTodo, title: '' }).success).toBe(false);
  });

  it('rejects a todo with non-UUID id', () => {
    expect(todoContract.safeParse({ ...mockTodo, id: 'not-a-uuid' }).success).toBe(false);
  });

  it('validates a todo list with all required fields', () => {
    const list = { items: [mockTodo], total: 1, page: 1, limit: 20, totalPages: 1 };
    expect(() => todoListContract.parse(list)).not.toThrow();
  });

  it('rejects a todo list missing items', () => {
    const result = todoListContract.safeParse({ total: 1, page: 1, limit: 20, totalPages: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a todo list missing total', () => {
    const result = todoListContract.safeParse({ items: [], page: 1, limit: 20, totalPages: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a todo list missing page', () => {
    const result = todoListContract.safeParse({ items: [], total: 0, limit: 20, totalPages: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a todo list missing limit', () => {
    const result = todoListContract.safeParse({ items: [], total: 0, page: 1, totalPages: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a todo list with negative total', () => {
    const result = todoListContract.safeParse({
      items: [],
      total: -1,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    expect(result.success).toBe(false);
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
  it.each(['admin', 'user', 'moderator'] as const)('accepts role "%s"', (role) => {
    expect(() => userPublicContract.parse({ ...mockUser, role })).not.toThrow();
  });

  it('rejects a user with invalid role', () => {
    expect(userPublicContract.safeParse({ ...mockUser, role: 'superadmin' }).success).toBe(false);
  });

  it('rejects a user with invalid email', () => {
    expect(userPublicContract.safeParse({ ...mockUser, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('validates auth tokens', () => {
    expect(() => authTokensContract.parse(mockAuthTokens)).not.toThrow();
  });

  it('rejects auth tokens with empty accessToken', () => {
    expect(authTokensContract.safeParse({ ...mockAuthTokens, accessToken: '' }).success).toBe(
      false,
    );
  });

  it('rejects auth tokens with empty refreshToken', () => {
    expect(authTokensContract.safeParse({ ...mockAuthTokens, refreshToken: '' }).success).toBe(
      false,
    );
  });

  it('validates a register response envelope', () => {
    expect(() => registerResponseSchema.parse(wrap(mockAuthTokens))).not.toThrow();
  });

  it('validates a refresh response envelope', () => {
    expect(() => refreshResponseSchema.parse(wrap({ accessToken: 'new-token' }))).not.toThrow();
  });

  it('rejects a refresh response with empty accessToken', () => {
    expect(refreshResponseSchema.safeParse(wrap({ accessToken: '' })).success).toBe(false);
  });

  it('rejects a refresh response missing accessToken', () => {
    expect(refreshResponseSchema.safeParse(wrap({})).success).toBe(false);
  });
});
