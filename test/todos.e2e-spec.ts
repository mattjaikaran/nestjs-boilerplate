import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Todos (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let todoId: string;

  const testUser = {
    email: `todos-test-${Date.now()}@example.com`,
    firstName: 'Todo',
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

    // Register and login
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);
    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/todos', () => {
    it('should create a todo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test todo', priority: 'high', tags: ['test'] })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Test todo');
      todoId = res.body.data.id;
    });

    it('should reject empty title', () => {
      return request(app.getHttpServer())
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '' })
        .expect(400);
    });
  });

  describe('GET /api/v1/todos', () => {
    it('should list todos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/todos?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/todos/stats', () => {
    it('should return todo stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/todos/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('completed');
    });
  });

  describe('GET /api/v1/todos/:id', () => {
    it('should get todo by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(todoId);
    });
  });

  describe('PATCH /api/v1/todos/:id', () => {
    it('should update todo', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(true);
    });
  });

  describe('DELETE /api/v1/todos/:id', () => {
    it('should delete todo', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });
});
