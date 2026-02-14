import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_PREFIX } from '@algoarena/shared';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

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
    allowedHeaders: [
      'Content-Type',
      'x-algoarena-api-key',
      'x-algoarena-cuid',
      'x-master-key',
    ],
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

  // Serve Scalar API docs at /docs
  app.getHttpAdapter().getInstance().get(
    '/docs',
    apiReference({
      withFastify: true,
      url: `/${API_PREFIX}/openapi.json`,
    }) as any,
  );

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`AlgoArena API running on http://0.0.0.0:${port}/${API_PREFIX}`);
  console.log(`API docs available at http://0.0.0.0:${port}/docs`);
}

bootstrap();
