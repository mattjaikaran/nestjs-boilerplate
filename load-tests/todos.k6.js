/**
 * Todos CRUD load test — uses a pre-seeded user for sustained reads/writes.
 *
 * Requires:
 *   TEST_EMAIL and TEST_PASSWORD env vars (or defaults from config.js)
 *
 * Run:
 *   k6 run load-tests/todos.k6.js
 *   k6 run --env TEST_EMAIL=admin@example.com --env TEST_PASSWORD=Admin123! load-tests/todos.k6.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { API, TEST_USER, defaultThresholds } from './config.js';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
    },
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      startTime: '35s',
    },
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '4m',
    },
  },
  thresholds: {
    ...defaultThresholds,
    'http_req_duration{name:list_todos}': ['p(95)<400'],
    'http_req_duration{name:create_todo}': ['p(95)<600'],
  },
};

// Login once per VU setup (setup() runs once globally, init code per VU)
export function setup() {
  const headers = { 'Content-Type': 'application/json' };
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
    { headers },
  );
  check(res, { 'setup login 200': (r) => r.status === 200 });
  const token = res.json()?.data?.accessToken ?? '';
  if (!token) throw new Error(`Login failed: ${res.body}`);
  return { token };
}

export default function ({ token }) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let todoId = '';

  group('create_todo', () => {
    const res = http.post(
      `${API}/todos`,
      JSON.stringify({ title: `Load test todo ${__VU}-${__ITER}`, priority: 'medium' }),
      { headers, tags: { name: 'create_todo' } },
    );
    check(res, { 'create 201': (r) => r.status === 201 });
    todoId = res.json()?.data?.id ?? '';
  });

  group('list_todos', () => {
    const res = http.get(`${API}/todos?page=1&limit=20`, {
      headers,
      tags: { name: 'list_todos' },
    });
    check(res, { 'list 200': (r) => r.status === 200 });
  });

  group('list_todos_v2_cursor', () => {
    const res = http.get(`${API}/v2/todos?limit=20`, {
      headers,
      tags: { name: 'list_todos_v2' },
    });
    check(res, { 'v2 list 200': (r) => r.status === 200 });
  });

  if (todoId) {
    group('get_todo', () => {
      const res = http.get(`${API}/todos/${todoId}`, { headers });
      check(res, { 'get 200': (r) => r.status === 200 });
    });

    group('update_todo', () => {
      const res = http.patch(
        `${API}/todos/${todoId}`,
        JSON.stringify({ status: 'completed' }),
        { headers },
      );
      check(res, { 'update 200': (r) => r.status === 200 });
    });

    group('delete_todo', () => {
      const res = http.del(`${API}/todos/${todoId}`, null, { headers });
      check(res, { 'delete 200': (r) => r.status === 200 });
    });
  }

  sleep(0.5);
}
