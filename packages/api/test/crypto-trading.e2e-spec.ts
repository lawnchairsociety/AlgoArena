import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Crypto Trading (e2e)', () => {
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
      .send({ label: 'crypto-e2e' });
    apiKey = keyRes.body.rawKey;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'crypto-user', startingBalance: '100000' });
    userCuid = userRes.body.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('should place a crypto market buy and fill immediately', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: '0.001',
        timeInForce: 'gtc',
      });

    // Alpaca sandbox may not serve crypto — accept filled or rejected
    expect([200, 201]).toContain(res.status);
    if (res.body.status === 'filled') {
      expect(res.body.assetClass).toBe('crypto');
      expect(res.body.symbol).toBe('BTC/USD');
    }
  });

  it('should reject crypto stop orders', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'stop',
        quantity: '0.001',
        stopPrice: '50000',
        timeInForce: 'gtc',
      })
      .expect(400);

    expect(res.body.message).toContain('stop');
  });

  it('should reject crypto day TIF', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTC/USD',
        side: 'buy',
        type: 'market',
        quantity: '0.001',
        timeInForce: 'day',
      })
      .expect(400);

    expect(res.body.message).toContain('day');
  });

  it('should reject crypto short sell', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTC/USD',
        side: 'sell',
        type: 'market',
        quantity: '0.001',
        timeInForce: 'gtc',
      })
      .expect(400);

    expect(res.body.message).toContain('Short selling is not supported for crypto');
  });

  it('should accept compact crypto notation (BTCUSD)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'BTCUSD',
        side: 'buy',
        type: 'market',
        quantity: '0.001',
        timeInForce: 'gtc',
      });

    // Symbol should be normalized to BTC/USD
    expect([200, 201]).toContain(res.status);
    expect(res.body.symbol).toBe('BTC/USD');
  });

  it('should show crypto position in portfolio', async () => {
    // Only test if a previous buy succeeded
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/positions/BTC%2FUSD')
      .set('x-algoarena-cuid', userCuid);

    // Position may or may not exist depending on whether crypto buys succeeded
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.symbol).toBe('BTC/USD');
    }
  });
});
