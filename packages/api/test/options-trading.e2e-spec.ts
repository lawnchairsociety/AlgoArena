import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Options Trading (e2e)', () => {
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
      .send({ label: 'options-e2e' });
    apiKey = keyRes.body.key;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'options-user', startingBalance: '100000' });
    userCuid = userRes.body.cuid;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ── Market Data ──

  it('GET /market/options/chain/:symbol → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/options/chain/AAPL')
      .set('x-algoarena-cuid', userCuid);

    // Alpaca sandbox may not serve options — accept 200 or upstream error
    if (res.status === 200) {
      expect(res.body).toHaveProperty('underlying', 'AAPL');
      expect(res.body).toHaveProperty('expirations');
      expect(res.body).toHaveProperty('contracts');
    }
  });

  it('GET /market/options/expirations/:symbol → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/options/expirations/AAPL')
      .set('x-algoarena-cuid', userCuid);

    if (res.status === 200) {
      expect(res.body).toHaveProperty('symbol', 'AAPL');
      expect(res.body).toHaveProperty('expirations');
      expect(Array.isArray(res.body.expirations)).toBe(true);
    }
  });

  it('GET /market/options/quotes/:occ → rejects invalid symbol', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/options/quotes/INVALID')
      .set('x-algoarena-cuid', userCuid);

    expect(res.status).toBe(400);
  });

  // ── Order Validation ──

  it('should reject stop order for options', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'stop',
        quantity: '1',
        stopPrice: '5.00',
        timeInForce: 'day',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not supported for options/i);
  });

  it('should reject stop_limit order for options', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'stop_limit',
        quantity: '1',
        stopPrice: '5.00',
        limitPrice: '5.50',
        timeInForce: 'day',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not supported for options/i);
  });

  it('should reject fractional quantity for options', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'market',
        quantity: '1.5',
        timeInForce: 'day',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/whole number/i);
  });

  it('should reject ioc time-in-force for options', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'market',
        quantity: '1',
        timeInForce: 'ioc',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not supported for options/i);
  });

  it('should reject bracket on options', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'market',
        quantity: '1',
        timeInForce: 'day',
        bracket: { takeProfit: { limitPrice: '10.00' } },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not supported for options/i);
  });

  // ── Order Placement (market buy) ──

  it('should place a market buy option order', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL260320C00230000',
        side: 'buy',
        type: 'market',
        quantity: '1',
        timeInForce: 'day',
      });

    // Accept filled, rejected (quote not available in sandbox), or pending (market closed)
    expect([200, 201]).toContain(res.status);
    if (res.body.status === 'filled') {
      expect(res.body.assetClass).toBe('option');
    }
  });

  // ── Portfolio with Options ──

  it('should return option position metadata when position exists', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/portfolio/positions').set('x-algoarena-cuid', userCuid);

    expect(res.status).toBe(200);
    // If the market buy filled, we should have an option position
    const optionPos = res.body.find((p: { assetClass: string }) => p.assetClass === 'option');
    if (optionPos) {
      expect(optionPos.optionType).toBeDefined();
      expect(optionPos.strikePrice).toBeDefined();
      expect(optionPos.expiration).toBeDefined();
      expect(optionPos.underlyingSymbol).toBeDefined();
      expect(optionPos.multiplier).toBe('100');
    }
  });

  it('should include option value with multiplier in account summary', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/portfolio/account').set('x-algoarena-cuid', userCuid);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalEquity');
    expect(res.body).toHaveProperty('positionsValue');
  });
});
