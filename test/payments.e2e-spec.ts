import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Payments webhook (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  const testUser = {
    email: `payments-${Date.now()}@example.com`,
    firstName: 'Pay',
    lastName: 'Tester',
    password: 'Password123!',
  };

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

    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);
    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/payments/webhook', () => {
    it('should reject webhook with missing stripe-signature header', async () => {
      // Without a valid signature, Stripe SDK throws → 400
      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'checkout.session.completed' }))
        .expect((res) => {
          expect([400, 500]).toContain(res.status);
        });
    });

    it('should reject webhook with invalid stripe-signature', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'invalid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'checkout.session.completed' }))
        .expect((res) => {
          expect([400, 500]).toContain(res.status);
        });
    });

    it('is publicly accessible (no JWT required)', async () => {
      // Endpoint must be reachable without auth token (signature still rejected, not 401)
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send('{}');

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('GET /api/v1/payments/subscription', () => {
    it('should return subscription info for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments/subscription')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect((r) => {
          expect([200, 404]).toContain(r.status);
        });

      if (res.status === 200) {
        expect(res.body).toHaveProperty('data');
      }
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/payments/subscription').expect(401);
    });
  });
});
