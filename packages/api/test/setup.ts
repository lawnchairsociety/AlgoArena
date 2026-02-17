import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

let app: NestFastifyApplication;

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
  }
}
