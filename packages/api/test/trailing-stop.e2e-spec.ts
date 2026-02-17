import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Trailing Stop Orders (e2e)', () => {
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
      .send({ label: 'trailing-stop-e2e' });
    apiKey = keyRes.body.rawKey;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'trailing-stop-user', startingBalance: '100000' });
    userCuid = userRes.body.id;

    // Buy AAPL so we have a long position for trailing stop sells
    await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: '20',
        timeInForce: 'day',
      });
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('should place a trailing stop with trailPercent', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'sell',
        type: 'trailing_stop',
        quantity: '5',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      });

    // Accept 200 or 201 — order may be pending or the response code may vary
    expect([200, 201]).toContain(res.status);
    expect(res.body.type).toBe('trailing_stop');
    expect(res.body.trailPercent).toBe('3.0000');
    expect(res.body.highWaterMark).toBeTruthy();
    expect(res.body.trailingStopPrice).toBeTruthy();
  });

  it('should place a trailing stop with trailPrice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'sell',
        type: 'trailing_stop',
        quantity: '5',
        trailPrice: '5.00',
        timeInForce: 'gtc',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.type).toBe('trailing_stop');
    expect(res.body.trailPrice).toBe('5.0000');
    expect(res.body.highWaterMark).toBeTruthy();
    expect(res.body.trailingStopPrice).toBeTruthy();
  });

  it('should reject buy-side trailing stop', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'trailing_stop',
        quantity: '5',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      })
      .expect(400);

    expect(res.body.message).toContain('sell');
  });

  it('should reject both trailPercent and trailPrice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'sell',
        type: 'trailing_stop',
        quantity: '5',
        trailPercent: '3.0',
        trailPrice: '5.00',
        timeInForce: 'gtc',
      })
      .expect(400);

    expect(res.body.message).toMatch(/only one/i);
  });

  it('should reject trailing stop with IOC TIF', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'AAPL',
        side: 'sell',
        type: 'trailing_stop',
        quantity: '5',
        trailPercent: '3.0',
        timeInForce: 'ioc',
      })
      .expect(400);

    expect(res.body.message).toContain('day or gtc');
  });

  it('should reject trailing stop without sufficient position', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({
        symbol: 'MSFT',
        side: 'sell',
        type: 'trailing_stop',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      })
      .expect(400);

    expect(res.body.message).toMatch(/position/i);
  });
});
