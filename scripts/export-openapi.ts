/**
 * Boots NestJS in headless mode (no listen), extracts the Swagger document,
 * and writes it to generated/openapi.json.
 *
 * Usage: bun run openapi:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Boilerplate API')
    .setDescription('Production-ready NestJS 11 API with comprehensive auth')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outDir = join(process.cwd(), 'generated');
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI schema written to ${outPath}`);

  await app.close();
}

exportOpenApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
