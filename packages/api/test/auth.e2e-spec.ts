import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let masterKey: string;
  let apiKey: string;
  let _apiKeyId: string;
  let userCuid: string;

  beforeAll(async () => {
    app = await createTestApp();
    masterKey = process.env.MASTER_KEY!;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('POST /api/v1/auth/api-keys — create API key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/api-keys')
      .set('x-master-key', masterKey)
      .send({ label: 'e2e-test' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('rawKey');
    expect(res.body.label).toBe('e2e-test');
    _apiKeyId = res.body.id;
    apiKey = res.body.rawKey;
  });

  it('POST /api/v1/auth/api-keys — reject invalid master key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/api-keys')
      .set('x-master-key', 'invalid-key')
      .send({})
      .expect(403);
  });

  it('POST /api/v1/auth/users — create CUID user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'e2e-user', startingBalance: '100000' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.label).toBe('e2e-user');
    userCuid = res.body.id;
  });

  it('POST /api/v1/auth/users — reject invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ startingBalance: 'not-a-number' })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });

  it('GET /api/v1/auth/users/:cuid — get user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/auth/users/${userCuid}`)
      .set('x-algoarena-cuid', userCuid)
      .expect(200);

    expect(res.body.id).toBe(userCuid);
  });

  it('GET /api/v1/auth/users — list users', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/auth/users/:cuid/reset — reset account', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/auth/users/${userCuid}/reset`)
      .set('x-algoarena-api-key', apiKey)
      .send({ startingBalance: '50000' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  it('DELETE /api/v1/auth/api-keys/:id — revoke key', async () => {
    // Create a throwaway key to revoke
    const create = await request(app.getHttpServer())
      .post('/api/v1/auth/api-keys')
      .set('x-master-key', masterKey)
      .send({ label: 'to-revoke' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/api-keys/${create.body.id}`)
      .set('x-master-key', masterKey)
      .expect(204);
  });
});
