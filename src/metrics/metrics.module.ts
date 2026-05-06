import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const AUTH_LOGIN_COUNTER = 'auth_login_total';
export const AUTH_REGISTER_COUNTER = 'auth_register_total';
export const HTTP_REQUEST_DURATION = 'http_request_duration_seconds';
export const QUEUE_JOB_COUNTER = 'queue_job_total';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: AUTH_LOGIN_COUNTER,
      help: 'Total login attempts',
      labelNames: ['status', 'method'],
    }),
    makeCounterProvider({
      name: AUTH_REGISTER_COUNTER,
      help: 'Total registration attempts',
      labelNames: ['status'],
    }),
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
    makeCounterProvider({
      name: QUEUE_JOB_COUNTER,
      help: 'Total background queue jobs processed',
      labelNames: ['queue', 'job', 'status'],
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
