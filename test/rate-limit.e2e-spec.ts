import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests under the short-window limit (10/1s)', async () => {
    // Health endpoint is public — 9 rapid requests should all succeed
    const responses = await Promise.all(
      Array.from({ length: 9 }, () => request(app.getHttpServer()).get('/api/v1/health')),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('should return 429 after exceeding short-window limit (10/1s)', async () => {
    // Fire 15 concurrent requests — some must be throttled
    const responses = await Promise.all(
      Array.from({ length: 15 }, () => request(app.getHttpServer()).get('/api/v1/health')),
    );

    const statuses = responses.map((r) => r.status);
    const throttled = statuses.filter((s) => s === 429);
    expect(throttled.length).toBeGreaterThan(0);
  });

  it('should include Retry-After or X-RateLimit-* headers on 429', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => request(app.getHttpServer()).get('/api/v1/health')),
    );

    const hit = responses.find((r) => r.status === 429);
    if (hit) {
      const hasRateLimitHeader =
        'retry-after' in hit.headers ||
        'x-ratelimit-limit' in hit.headers ||
        'x-ratelimit-remaining' in hit.headers;
      expect(hasRateLimitHeader).toBe(true);
    }
  });
});
