import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { closeTestApp, createTestApp } from './setup';

describe('Bracket Orders (e2e)', () => {
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
      .send({ label: 'bracket-e2e' });
    apiKey = keyRes.body.key;

    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/users')
      .set('x-algoarena-api-key', apiKey)
      .send({ label: 'bracket-user', startingBalance: '100000' });
    userCuid = userRes.body.cuid;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const placeOrder = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/trading/orders')
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid)
      .send(body);

  const getOrder = (orderId: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/trading/orders/${orderId}`)
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid);

  it('should place bracket market buy and create TP + SL children', async () => {
    const res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'market',
      quantity: '0.01',
      timeInForce: 'gtc',
      bracket: {
        takeProfit: { limitPrice: '999999.00' },
        stopLoss: { stopPrice: '10000.00', limitPrice: '9999.00' },
      },
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('filled');
    expect(res.body.bracketRole).toBe('entry');
    expect(res.body.bracket).toBeDefined();
    expect(res.body.bracket.takeProfitOrderId).toBeDefined();
    expect(res.body.bracket.stopLossOrderId).toBeDefined();

    // Verify TP child
    const tpRes = await getOrder(res.body.bracket.takeProfitOrderId);
    expect(tpRes.body.type).toBe('limit');
    expect(tpRes.body.side).toBe('sell');
    expect(tpRes.body.limitPrice).toBe('999999.0000');
    expect(tpRes.body.status).toBe('pending');
    expect(tpRes.body.parentOrderId).toBe(res.body.id);
    expect(tpRes.body.bracketRole).toBe('take_profit');

    // Verify SL child
    const slRes = await getOrder(res.body.bracket.stopLossOrderId);
    expect(slRes.body.type).toBe('stop_limit');
    expect(slRes.body.side).toBe('sell');
    expect(slRes.body.stopPrice).toBe('10000.0000');
    expect(slRes.body.limitPrice).toBe('9999.0000');
    expect(slRes.body.status).toBe('pending');
    expect(slRes.body.parentOrderId).toBe(res.body.id);
    expect(slRes.body.bracketRole).toBe('stop_loss');

    // Verify OCO link between TP and SL
    expect(tpRes.body.linkedOrderId).toBe(slRes.body.id);
    expect(slRes.body.linkedOrderId).toBe(tpRes.body.id);
  });

  it('should reject bracket on trailing_stop', async () => {
    // First buy something so we can sell
    await placeOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'market',
      quantity: '0.01',
      timeInForce: 'gtc',
    });

    const res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'sell',
      type: 'trailing_stop',
      quantity: '0.01',
      trailPercent: '3.0',
      timeInForce: 'gtc',
      bracket: {
        takeProfit: { limitPrice: '50000.00' },
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('trailing_stop');
  });

  it('should reject bracket with invalid TP/SL price relationship (buy)', async () => {
    const res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'market',
      quantity: '0.01',
      timeInForce: 'gtc',
      bracket: {
        takeProfit: { limitPrice: '10000.00' },
        stopLoss: { stopPrice: '20000.00', limitPrice: '19999.00' },
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('buy bracket');
  });

  it('should place bracket limit buy (far below market) as pending with no children', async () => {
    const res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'limit',
      quantity: '0.01',
      limitPrice: '1.00',
      timeInForce: 'gtc',
      bracket: {
        takeProfit: { limitPrice: '999999.00' },
        stopLoss: { stopPrice: '0.50', limitPrice: '0.49' },
      },
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('pending');
    expect(res.body.bracketRole).toBe('entry');
    // No children yet since entry hasn't filled
    expect(res.body.bracket).toBeUndefined();
  });

  it('should cancel pending bracket entry without error', async () => {
    // Place a bracket limit order that stays pending
    const orderRes = await placeOrder({
      symbol: 'BTC/USD',
      side: 'buy',
      type: 'limit',
      quantity: '0.01',
      limitPrice: '1.00',
      timeInForce: 'gtc',
      bracket: {
        takeProfit: { limitPrice: '999999.00' },
      },
    });
    expect(orderRes.body.status).toBe('pending');

    const cancelRes = await request(app.getHttpServer())
      .delete(`/api/v1/trading/orders/${orderRes.body.id}`)
      .set('x-algoarena-api-key', apiKey)
      .set('x-algoarena-cuid', userCuid);

    expect([200, 204]).toContain(cancelRes.status);
  });

  it('should link two orders with ocoLinkedTo', async () => {
    // Place first limit order (far from market, stays pending)
    const order1Res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'sell',
      type: 'limit',
      quantity: '0.001',
      limitPrice: '999999.00',
      timeInForce: 'gtc',
    });
    expect(order1Res.body.status).toBe('pending');

    // Place second order linked to first
    const order2Res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'sell',
      type: 'limit',
      quantity: '0.001',
      limitPrice: '999998.00',
      timeInForce: 'gtc',
      ocoLinkedTo: order1Res.body.id,
    });
    expect(order2Res.body.status).toBe('pending');

    // Verify bidirectional link
    const o1 = await getOrder(order1Res.body.id);
    const o2 = await getOrder(order2Res.body.id);
    expect(o1.body.linkedOrderId).toBe(order2Res.body.id);
    expect(o2.body.linkedOrderId).toBe(order1Res.body.id);
  });

  it('should reject ocoLinkedTo with non-existent order', async () => {
    const res = await placeOrder({
      symbol: 'BTC/USD',
      side: 'sell',
      type: 'limit',
      quantity: '0.001',
      limitPrice: '999999.00',
      timeInForce: 'gtc',
      ocoLinkedTo: '00000000-0000-0000-0000-000000000000',
    });

    expect(res.status).toBe(404);
  });

  it('should reject ocoLinkedTo with different symbol', async () => {
    // Place BTC order
    const btcOrder = await placeOrder({
      symbol: 'BTC/USD',
      side: 'sell',
      type: 'limit',
      quantity: '0.001',
      limitPrice: '999999.00',
      timeInForce: 'gtc',
    });
    expect(btcOrder.body.status).toBe('pending');

    // Buy ETH first
    await placeOrder({
      symbol: 'ETH/USD',
      side: 'buy',
      type: 'market',
      quantity: '0.01',
      timeInForce: 'gtc',
    });

    // Try to link ETH order to BTC order
    const res = await placeOrder({
      symbol: 'ETH/USD',
      side: 'sell',
      type: 'limit',
      quantity: '0.01',
      limitPrice: '999999.00',
      timeInForce: 'gtc',
      ocoLinkedTo: btcOrder.body.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('same symbol');
  });
});
