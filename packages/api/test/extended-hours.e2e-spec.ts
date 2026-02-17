import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Extended Hours Trading (e2e)', () => {
  let app: NestFastifyApplication;
  let masterKey: string;
  let apiKey: string;
  let userCuid: string;

  beforeAll(async () => {
    app = await createTestApp();
    masterKey = process.env.MASTER_KEY!;

    const keyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/api-keys')
      .set('x-master-key', masterKey)
      .send({ label: 'ext-hours-e2e' });
    apiKey = keyRes.body.key;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'ext-hours-user', startingBalance: '100000' });
    userCuid = userRes.body.cuid;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ── Valid extended hours order ──

  it('places extended hours limit order → 201 with extendedHours: true', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: '1',
        limitPrice: '100.00',
        timeInForce: 'day',
        extendedHours: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.extendedHours).toBe(true);
    expect(res.body.type).toBe('limit');
  });

  // ── Rejected combinations ──

  it('rejects market + extendedHours → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: '1',
        timeInForce: 'day',
        extendedHours: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not supported for extended hours/i);
  });

  it('rejects crypto + extendedHours → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'limit',
        quantity: '0.01',
        limitPrice: '50000',
        timeInForce: 'gtc',
        extendedHours: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/crypto/i);
  });

  it('rejects option + extendedHours → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'limit',
        quantity: '1',
        limitPrice: '5.00',
        timeInForce: 'day',
        extendedHours: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/options/i);
  });

  // ── Clock endpoint returns session ──

  it('GET /market/clock returns session field', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/market/clock').set('x-algoarena-cuid', userCuid);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('session');
    expect(['pre_market', 'regular', 'after_hours', 'closed']).toContain(res.body.session);
    expect(res.body).toHaveProperty('sessions');
    expect(res.body.sessions).toHaveProperty('preMarket');
    expect(res.body.sessions).toHaveProperty('regular');
    expect(res.body.sessions).toHaveProperty('afterHours');
  });

  // ── Default behavior unchanged ──

  it('order without extendedHours defaults to false', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: '1',
        limitPrice: '100.00',
        timeInForce: 'day',
      });

    expect(res.status).toBe(201);
    expect(res.body.extendedHours).toBe(false);
  });
});
