import * as request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

describe('Portfolio (e2e)', () => {
  let app: NestFastifyApplication;
  let masterKey: string;
  let apiKey: string;
  let userCuid: string;

  beforeAll(async () => {
    app = await createTestApp();
    masterKey = process.env.MASTER_KEY!;

    // Create fresh credentials
    const keyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/api-keys')
      .set('x-master-key', masterKey)
      .send({ label: 'portfolio-e2e' });
    apiKey = keyRes.body.key;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'portfolio-user', startingBalance: '100000' });
    userCuid = userRes.body.cuid;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /api/v1/portfolio/account — get account summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/account')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('cashBalance');
    expect(res.body).toHaveProperty('totalEquity');
  });

  it('GET /api/v1/portfolio/positions — list positions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/positions')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/portfolio/history — get portfolio history', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/history?days=7')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/portfolio/history — reject invalid days param', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/history?days=-1')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  it('GET /api/v1/portfolio/trades — get trade history', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/trades')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/portfolio/trades — with pagination params', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/trades?limit=5&offset=0')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
