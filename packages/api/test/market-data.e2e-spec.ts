import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

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
    apiKey = keyRes.body.rawKey;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'market-user' });
    userCuid = userRes.body.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /api/v1/market/clock — get market clock', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/clock')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('isOpen');
  });

  it('GET /api/v1/market/quotes/:symbol — get quote', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/quotes/AAPL')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('askPrice');
  });

  it('GET /api/v1/market/quotes — get multiple quotes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/quotes?symbols=AAPL,MSFT')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('GET /api/v1/market/quotes — reject missing symbols param', async () => {
    await request(app.getHttpServer()).get('/api/v1/market/quotes').set('x-algoarena-cuid', userCuid).expect(400);
  });

  it('GET /api/v1/market/assets — list assets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/assets')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/market/bars — get bars for multiple symbols', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/bars?symbols=AAPL,MSFT&timeframe=1Day')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('bars');
    expect(typeof res.body.bars).toBe('object');
  });

  it('GET /api/v1/market/bars — reject missing symbols', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/market/bars?timeframe=1Day')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  it('GET /api/v1/market/bars — reject missing timeframe', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/market/bars?symbols=AAPL')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  it('GET /api/v1/market/bars/:symbol — reject missing timeframe', async () => {
    await request(app.getHttpServer()).get('/api/v1/market/bars/AAPL').set('x-algoarena-cuid', userCuid).expect(400);
  });

  it('GET /api/v1/market/calendar — get calendar', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/calendar')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Crypto Market Data ──

  it('GET /api/v1/market/clock?class=crypto — always open', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/clock?class=crypto')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body.isOpen).toBe(true);
    expect(res.body.nextOpen).toBeNull();
    expect(res.body.nextClose).toBeNull();
  });

  it('GET /api/v1/market/quotes/BTC%2FUSD — crypto quote', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/market/quotes/BTC%2FUSD')
      .set('x-algoarena-cuid', userCuid);

    // Alpaca sandbox may not serve crypto — accept 200 or 400
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('askPrice');
      expect(res.body).toHaveProperty('bidPrice');
    }
  });
});
