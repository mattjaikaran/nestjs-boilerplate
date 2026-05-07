// Sentry must be initialized before any other imports
import './instrument';
import { startTracing } from './tracing';
startTracing();

import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupAdmin } from './admin/admin.setup';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV !== 'test',
      trustProxy: true,
    }),
  );

  const configService = app.get(ConfigService);
  const isProd = configService.get('NODE_ENV') === 'production';

  // Graceful shutdown
  app.enableShutdownHooks();

  // WebSocket adapter (Socket.io)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security headers — CSP disabled globally; AdminJS uses inline scripts/styles
  await app.register(helmet as never, {
    contentSecurityPolicy: false,
  });

  // Response compression (brotli → gzip → deflate)
  await app.register(compress as never, { global: true });

  // Raw body parser for Stripe webhook signature verification
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: unknown, body: Buffer, done: (err: Error | null, body: Buffer) => void) => {
      (req as Record<string, unknown>).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (e) {
        done(e as Error, body);
      }
    },
  );

  // Multipart / file uploads
  await app.register(multipart as never, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 5,
    },
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*').split(','),
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors — order matters: context first, then logging, then transform
  app.useGlobalInterceptors(
    new RequestContextInterceptor(),
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // Swagger (disabled in production)
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS Boilerplate API')
      .setDescription('Production-ready NestJS 11 API with comprehensive auth')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get('PORT', 3000);
  const host = configService.get('HOST', '0.0.0.0');

  // Admin panel (AdminJS + @adminjs/fastify + @adminjs/sql)
  const adminCookieSecret = configService.get<string>('ADMIN_COOKIE_SECRET');
  const databaseUrl = configService.get<string>('DATABASE_URL', '');
  const appName = configService.get<string>('APP_NAME', 'NestJS Boilerplate');
  if (adminCookieSecret) {
    const dbName = new URL(databaseUrl).pathname.slice(1);
    await setupAdmin(fastify, {
      databaseUrl,
      databaseName: dbName,
      appName,
      cookieSecret: adminCookieSecret,
      port,
    });
  }

  // Serve compiled frontend (react-rsbuild or any SPA) from public/
  // Set SERVE_FRONTEND=true + place build output in public/
  const serveFrontend = configService.get<string>('SERVE_FRONTEND') === 'true';
  if (serveFrontend) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      await app.register(staticFiles as never, {
        root: publicDir,
        prefix: '/',
        // Serve index.html for unknown routes so SPA client-side routing works
        decorateReply: false,
      });
      const fastifyInstance = app.getHttpAdapter().getInstance() as import(
        'fastify',
      ).FastifyInstance;
      fastifyInstance.setNotFoundHandler((_req, reply) => {
        reply.sendFile('index.html');
      });
      console.log(`Frontend served from: ${publicDir}`);
    }
  }

  await app.listen(port, host);
  console.log(`Application running on: http://${host}:${port}/api/v1`);
  if (!isProd) console.log(`Swagger docs: http://${host}:${port}/docs`);
}

bootstrap();
