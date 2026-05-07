/**
 * Auth load test — register, login, refresh, logout.
 *
 * Run:
 *   k6 run load-tests/auth.k6.js
 *   k6 run --env BASE_URL=https://staging.example.com load-tests/auth.k6.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { API, defaultThresholds } from './config.js';

const loginDuration = new Trend('login_duration', true);
const registerDuration = new Trend('register_duration', true);
const refreshDuration = new Trend('refresh_duration', true);
const failedLogins = new Counter('failed_logins');

export const options = {
  scenarios: {
    // Smoke test — 1 VU, 30s
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    // Ramp-up load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'load' },
      startTime: '35s', // after smoke
    },
  },
  thresholds: {
    ...defaultThresholds,
    login_duration: ['p(95)<300'],
    register_duration: ['p(95)<500'],
  },
};

const headers = { 'Content-Type': 'application/json' };

export default function () {
  const email = `loadtest_${__VU}_${__ITER}@example.com`;
  const password = 'LoadTest123!';

  group('register', () => {
    const res = http.post(
      `${API}/auth/register`,
      JSON.stringify({ email, firstName: 'Load', lastName: 'Test', password }),
      { headers },
    );
    registerDuration.add(res.timings.duration);
    check(res, { 'register 201': (r) => r.status === 201 });
  });

  let accessToken = '';
  let refreshToken = '';

  group('login', () => {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({ email, password }),
      { headers },
    );
    loginDuration.add(res.timings.duration);
    const ok = check(res, { 'login 200': (r) => r.status === 200 });
    if (!ok) {
      failedLogins.add(1);
      return;
    }
    const body = res.json();
    accessToken = body?.data?.accessToken ?? '';
    refreshToken = body?.data?.refreshToken ?? '';
  });

  if (!accessToken) return;

  group('refresh', () => {
    const res = http.post(
      `${API}/auth/refresh`,
      JSON.stringify({ refreshToken }),
      { headers },
    );
    refreshDuration.add(res.timings.duration);
    check(res, { 'refresh 200': (r) => r.status === 200 });
    const body = res.json();
    accessToken = body?.data?.accessToken ?? accessToken;
    refreshToken = body?.data?.refreshToken ?? refreshToken;
  });

  group('logout', () => {
    const res = http.post(
      `${API}/auth/logout`,
      JSON.stringify({ refreshToken }),
      { headers: { ...headers, Authorization: `Bearer ${accessToken}` } },
    );
    check(res, { 'logout 204': (r) => r.status === 204 });
  });

  sleep(1);
}
