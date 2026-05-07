export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API = `${BASE_URL}/api/v1`;

export const TEST_USER = {
  email: __ENV.TEST_EMAIL || 'loadtest@example.com',
  password: __ENV.TEST_PASSWORD || 'LoadTest123!',
  firstName: 'Load',
  lastName: 'Test',
};

/** Reusable thresholds for all scenarios */
export const defaultThresholds = {
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true }], // < 1% errors
  http_req_duration: ['p(95)<500', 'p(99)<1000'],                   // 95th < 500ms
};
