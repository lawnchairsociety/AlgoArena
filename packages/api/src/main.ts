import { API_PREFIX } from '@algoarena/shared';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.setGlobalPrefix(API_PREFIX);
  app.useWebSocketAdapter(new WsAdapter(app));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev server
    ],
    allowedHeaders: ['Content-Type', 'x-algoarena-api-key', 'x-algoarena-cuid', 'x-master-key'],
    exposedHeaders: ['Link'],
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('AlgoArena API')
    .setDescription('Paper trading platform for algorithmic trading strategies')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-algoarena-api-key', in: 'header' }, 'api-key')
    .addApiKey({ type: 'apiKey', name: 'x-algoarena-cuid', in: 'header' }, 'cuid')
    .addApiKey({ type: 'apiKey', name: 'x-master-key', in: 'header' }, 'master-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Serve OpenAPI JSON
  SwaggerModule.setup(`${API_PREFIX}/openapi`, app, document, {
    jsonDocumentUrl: `${API_PREFIX}/openapi.json`,
  });

  // Link header for agent discoverability
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (_request: any, reply: any, payload: any, done: any) => {
    reply.header('Link', '</agent-guide.md>; rel="help", </api/v1/openapi.json>; rel="service-desc"');
    done(null, payload);
  });

  // Serve Scalar API docs at /docs
  const scalarHtml = `<!doctype html>
<html>
<head>
  <title>AlgoArena API Docs</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/${API_PREFIX}/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  const sendDocs = (_req: any, reply: any) => reply.type('text/html').send(scalarHtml);
  fastify.get('/docs', sendDocs);
  fastify.get('/docs/', sendDocs);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`AlgoArena API running on http://0.0.0.0:${port}/${API_PREFIX}`);
  console.log(`API docs available at http://0.0.0.0:${port}/docs`);
}

bootstrap();
