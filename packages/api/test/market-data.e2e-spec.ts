import * as request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

describe('Market Data (e2e)', () => {
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
      .send({ label: 'market-e2e' });
    apiKey = keyRes.body.key;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'market-user' });
    userCuid = userRes.body.cuid;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /api/v1/market/clock — get market clock', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/clock')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('is_open');
  });

  it('GET /api/v1/market/quotes/:symbol — get quote', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/quotes/AAPL')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('symbol');
  });

  it('GET /api/v1/market/quotes — get multiple quotes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/quotes?symbols=AAPL,MSFT')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('GET /api/v1/market/quotes — reject missing symbols param', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/market/quotes')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  it('GET /api/v1/market/assets — list assets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/assets')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/market/bars/:symbol — reject missing timeframe', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/market/bars/AAPL')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  it('GET /api/v1/market/calendar — get calendar', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/calendar')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
