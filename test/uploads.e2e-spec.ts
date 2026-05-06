import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Uploads (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  const testUser = {
    email: `uploads-${Date.now()}@example.com`,
    firstName: 'Upload',
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

  describe('POST /api/v1/uploads', () => {
    it('should upload a file and return url + filename', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('hello world'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('url');
      expect(res.body.data).toHaveProperty('filename');
    });

    it('should reject request with no file', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .attach('file', Buffer.from('data'), { filename: 'test.txt', contentType: 'text/plain' })
        .expect(401);
    });
  });

  describe('POST /api/v1/uploads/avatar', () => {
    it('should upload avatar image', async () => {
      // 1x1 red PNG (minimal valid PNG bytes)
      const minimalPng = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
          '2e00000000c4944415478016360f8cfc000000000200012dd1db400000000' +
          '49454e44ae426082',
        'hex',
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/uploads/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', minimalPng, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body.data).toHaveProperty('url');
    });
  });
});
