import 'reflect-metadata';

import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { ConsoleLogger } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { StructuredExceptionFilter } from './common/exception.filter.js';
import { AppConfigService } from './config/config.module.js';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ trustProxy: true, logger: false }),
  {
    bufferLogs: true,
    logger: new ConsoleLogger({ json: true, colors: false, prefix: 'veyra-api' }),
  },
);
const config = app.get(AppConfigService).values;

await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: config.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
});
await app.register(multipart, {
  limits: {
    fileSize: config.MAX_UPLOAD_BYTES,
    files: 1,
    fields: 8,
    parts: 10,
  },
});
app.enableCors({
  origin: config.WEB_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'authorization',
    'content-type',
    'x-correlation-id',
    'x-dev-organization-id',
    'x-dev-user-id',
  ],
  exposedHeaders: ['x-correlation-id'],
  maxAge: 86_400,
});
app.useGlobalFilters(new StructuredExceptionFilter(app.get(HttpAdapterHost)));
app.enableShutdownHooks();

const swagger = new DocumentBuilder()
  .setTitle('Veyra API')
  .setDescription('Evidence-first enterprise knowledge and document intelligence API')
  .setVersion('1.0')
  .addBearerAuth()
  .addApiKey({ type: 'apiKey', in: 'header', name: 'x-dev-organization-id' }, 'development-org')
  .addApiKey({ type: 'apiKey', in: 'header', name: 'x-dev-user-id' }, 'development-user')
  .build();
SwaggerModule.setup('/docs', app, SwaggerModule.createDocument(app, swagger), {
  jsonDocumentUrl: '/docs/openapi.json',
  swaggerOptions: { persistAuthorization: false },
});

await app.listen(config.API_PORT, '0.0.0.0');
