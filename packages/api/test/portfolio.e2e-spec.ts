import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

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

  // ── Analytics ──

  it('GET /api/v1/portfolio/analytics — returns analytics structure', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/analytics')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('period');
    expect(res.body).toHaveProperty('returns');
    expect(res.body).toHaveProperty('risk');
    expect(res.body).toHaveProperty('trading');
    expect(res.body.returns).toHaveProperty('totalReturn');
    expect(res.body.risk).toHaveProperty('sharpeRatio');
    expect(res.body.trading).toHaveProperty('totalTrades');
  });

  it('GET /api/v1/portfolio/analytics?period=30d — accepts valid period', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/analytics?period=30d')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);
  });

  it('GET /api/v1/portfolio/analytics?period=invalid — rejects invalid period', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/analytics?period=invalid')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  // ── History ──

  it('GET /api/v1/portfolio/history?period=30d — returns wrapped history', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/history?period=30d')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('period', '30d');
    expect(res.body).toHaveProperty('interval', '1d');
    expect(res.body).toHaveProperty('snapshots');
    expect(Array.isArray(res.body.snapshots)).toBe(true);
  });

  it('GET /api/v1/portfolio/history?period=invalid — rejects invalid period', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/history?period=invalid')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });

  // ── Trades ──

  it('GET /api/v1/portfolio/trades — returns wrapped trades', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/trades')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('trades');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.trades)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('offset');
  });

  it('GET /api/v1/portfolio/trades?limit=10 — respects pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/trades?limit=10')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body.pagination.limit).toBe(10);
  });

  it('GET /api/v1/portfolio/trades?limit=600 — rejects over-limit', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/portfolio/trades?limit=600')
      .set('x-algoarena-cuid', userCuid)
      .expect(400);
  });
});
