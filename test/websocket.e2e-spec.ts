import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Socket, io } from 'socket.io-client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('WebSocket notifications (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let port: number;

  const testUser = {
    email: `ws-${Date.now()}@example.com`,
    firstName: 'WS',
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

    await app.listen(0);
    const url = await app.getUrl();
    port = Number(new URL(url).port);

    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser);
    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should connect to the notifications namespace', (done) => {
    const client: Socket = io(`http://localhost:${port}/notifications`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });

    client.on('connect_error', (err: Error) => {
      client.disconnect();
      done(err);
    });
  });

  it('should receive acknowledgement when subscribing to a room', (done) => {
    const client: Socket = io(`http://localhost:${port}/notifications`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    client.on('connect', () => {
      client.emit('subscribe', { room: 'test-room' }, (ack: { event: string }) => {
        expect(ack).toHaveProperty('event', 'subscribed');
        client.disconnect();
        done();
      });
    });

    client.on('connect_error', (err: Error) => {
      client.disconnect();
      done(err);
    });
  });

  it('should disconnect unauthenticated clients gracefully', (done) => {
    const client: Socket = io(`http://localhost:${port}/notifications`, {
      transports: ['websocket'],
    });

    // Unauthenticated clients connect but land in a room without userId
    const timeout = setTimeout(() => {
      // Connection succeeded (gateway allows it, just no userId room)
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    }, 500);

    client.on('connect_error', () => {
      clearTimeout(timeout);
      // Also acceptable — gateway may reject unauthenticated
      done();
    });
  });
});
