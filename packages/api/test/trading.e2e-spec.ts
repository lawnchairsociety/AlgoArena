import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Trading (e2e)', () => {
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
      .send({ label: 'trading-e2e' });
    apiKey = keyRes.body.rawKey;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'trading-user', startingBalance: '100000' });
    userCuid = userRes.body.id;

    // Disable price deviation check — these tests use hardcoded limit prices
    await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({ maxPriceDeviationPct: null });
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('POST /api/v1/trading/orders — place a limit order', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: '1',
        limitPrice: '150.00',
        timeInForce: 'day',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.symbol).toBe('AAPL');
    expect(res.body.side).toBe('buy');
    expect(res.body.type).toBe('limit');
  });

  it('POST /api/v1/trading/orders — reject invalid order (missing symbol)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        side: 'buy',
        type: 'market',
        quantity: '1',
        timeInForce: 'day',
      })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });

  it('POST /api/v1/trading/orders — reject invalid side', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'invalid',
        type: 'market',
        quantity: '1',
        timeInForce: 'day',
      })
      .expect(400);
  });

  it('GET /api/v1/trading/orders — list orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trading/orders')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/trading/orders — list orders with status filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trading/orders?status=pending&limit=10')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/trading/orders/:id — get order', async () => {
    // Place an order first
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'MSFT',
        side: 'buy',
        type: 'limit',
        quantity: '2',
        limitPrice: '300.00',
        timeInForce: 'gtc',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/trading/orders/${orderRes.body.id}`)
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body.id).toBe(orderRes.body.id);
    expect(res.body).toHaveProperty('fills');
  });

  it('DELETE /api/v1/trading/orders/:id — cancel order', async () => {
    // Place an order first
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'GOOG',
        side: 'buy',
        type: 'limit',
        quantity: '1',
        limitPrice: '100.00',
        timeInForce: 'day',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/trading/orders/${orderRes.body.id}`)
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body.status).toBe('cancelled');
  });
});
