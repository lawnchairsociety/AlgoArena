import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Risk Controls (e2e)', () => {
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
      .send({ label: 'risk-controls-e2e' });
    apiKey = keyRes.body.rawKey;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'risk-user', startingBalance: '100000' });
    userCuid = userRes.body.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /trading/risk-controls — returns default controls', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trading/risk-controls')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('userId', userCuid);
    expect(res.body).toHaveProperty('controls');
    expect(res.body).toHaveProperty('status');
    expect(res.body.controls.maxPositionPct).toBe('0.2500');
    expect(res.body.controls.maxPositions).toBe(50);
    expect(res.body.controls.maxDailyTrades).toBe(100);
    expect(res.body.controls.shortSellingEnabled).toBe(true);
    expect(res.body.status).toHaveProperty('dailyTradeCount');
    expect(res.body.status).toHaveProperty('isRestricted');
  });

  it('PUT /trading/risk-controls — update individual fields', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({ maxPositionPct: '0.15', maxDailyTrades: 20 })
      .expect(200);

    expect(res.body.maxPositionPct).toBe('0.1500');
    expect(res.body.maxDailyTrades).toBe(20);
  });

  it('PUT /trading/risk-controls — apply profile preset', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({ profile: 'conservative' })
      .expect(200);

    expect(res.body.maxPositionPct).toBe('0.1500');
    expect(res.body.maxPositions).toBe(20);
    expect(res.body.shortSellingEnabled).toBe(false);
    expect(res.body.autoFlattenOnLoss).toBe(true);
  });

  it('PUT /trading/risk-controls — invalid profile returns 400', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({ profile: 'invalid' })
      .expect(400);
  });

  it('GET /trading/risk-controls/events — returns events list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/trading/risk-controls/events')
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('PUT /trading/risk-controls — reset to unrestricted for subsequent tests', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send({ profile: 'unrestricted' })
      .expect(200);
  });

  it('PUT /trading/risk-controls — requires API key', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/trading/risk-controls')
      .set('x-algoarena-cuid', userCuid)
      .send({ maxDailyTrades: 10 })
      .expect(401);
  });

  it('GET /trading/risk-controls — requires CUID', async () => {
    await request(app.getHttpServer()).get('/api/v1/trading/risk-controls').expect(401);
  });
});
