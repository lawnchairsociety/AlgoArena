import Decimal from 'decimal.js';
import type { Quote } from '../market-data/types/market-data-provider.types';
import { OrderEngineService } from './order-engine.service';

describe('OrderEngineService', () => {
  let service: OrderEngineService;

  const makeQuote = (ask: number, bid: number): Quote => ({
    timestamp: '2026-01-15T10:00:00Z',
    askPrice: ask,
    askSize: 100,
    bidPrice: bid,
    bidSize: 100,
  });

  beforeEach(() => {
    // These methods are pure — no injected deps used
    service = new OrderEngineService(null as any, null as any, null as any, null as any);
  });

  // ── evaluateOrderConditions ──

  describe('evaluateOrderConditions', () => {
    const quote = makeQuote(150.5, 150.0);

    // Market orders
    it('market buy → returns ask', () => {
      const result = service.evaluateOrderConditions('market', 'buy', quote);
      expect(result).toEqual(new Decimal(150.5));
    });

    it('market sell → returns bid', () => {
      const result = service.evaluateOrderConditions('market', 'sell', quote);
      expect(result).toEqual(new Decimal(150.0));
    });

    // Limit orders
    it('limit buy: ask <= limit → fill at ask', () => {
      const result = service.evaluateOrderConditions('limit', 'buy', quote, '151.00');
      expect(result).toEqual(new Decimal(150.5));
    });

    it('limit buy: ask > limit → null', () => {
      const result = service.evaluateOrderConditions('limit', 'buy', quote, '149.00');
      expect(result).toBeNull();
    });

    it('limit sell: bid >= limit → fill at bid', () => {
      const result = service.evaluateOrderConditions('limit', 'sell', quote, '149.00');
      expect(result).toEqual(new Decimal(150.0));
    });

    it('limit sell: bid < limit → null', () => {
      const result = service.evaluateOrderConditions('limit', 'sell', quote, '151.00');
      expect(result).toBeNull();
    });

    // Stop orders
    it('stop buy: ask >= stop → fill at ask', () => {
      const result = service.evaluateOrderConditions('stop', 'buy', quote, null, '150.00');
      expect(result).toEqual(new Decimal(150.5));
    });

    it('stop buy: ask < stop → null', () => {
      const result = service.evaluateOrderConditions('stop', 'buy', quote, null, '151.00');
      expect(result).toBeNull();
    });

    it('stop sell: bid <= stop → fill at bid', () => {
      const result = service.evaluateOrderConditions('stop', 'sell', quote, null, '151.00');
      expect(result).toEqual(new Decimal(150.0));
    });

    it('stop sell: bid > stop → null', () => {
      const result = service.evaluateOrderConditions('stop', 'sell', quote, null, '149.00');
      expect(result).toBeNull();
    });

    // Stop-limit orders
    it('stop-limit buy: both conditions met → fill at ask', () => {
      // ask (150.5) >= stop (150) && ask (150.5) <= limit (151)
      const result = service.evaluateOrderConditions('stop_limit', 'buy', quote, '151.00', '150.00');
      expect(result).toEqual(new Decimal(150.5));
    });

    it('stop-limit buy: stop met but ask > limit → null', () => {
      // ask (150.5) >= stop (149) but ask (150.5) > limit (150)
      const result = service.evaluateOrderConditions('stop_limit', 'buy', quote, '150.00', '149.00');
      expect(result).toBeNull();
    });

    it('stop-limit buy: ask < stop → null', () => {
      // ask (150.5) < stop (151)
      const result = service.evaluateOrderConditions('stop_limit', 'buy', quote, '155.00', '151.00');
      expect(result).toBeNull();
    });

    it('stop-limit sell: both conditions met → fill at bid', () => {
      // bid (150) <= stop (151) && bid (150) >= limit (149)
      const result = service.evaluateOrderConditions('stop_limit', 'sell', quote, '149.00', '151.00');
      expect(result).toEqual(new Decimal(150.0));
    });

    it('stop-limit sell: stop met but bid < limit → null', () => {
      // bid (150) <= stop (151) but bid (150) < limit (150.5)
      const result = service.evaluateOrderConditions('stop_limit', 'sell', quote, '150.50', '151.00');
      expect(result).toBeNull();
    });

    it('stop-limit sell: bid > stop → null', () => {
      // bid (150) > stop (149)
      const result = service.evaluateOrderConditions('stop_limit', 'sell', quote, '148.00', '149.00');
      expect(result).toBeNull();
    });

    // Boundary cases
    it('boundary: ask exactly equals limit price → fills (limit buy)', () => {
      const result = service.evaluateOrderConditions('limit', 'buy', quote, '150.50');
      expect(result).toEqual(new Decimal(150.5));
    });

    it('boundary: bid exactly equals stop price → fills (stop sell)', () => {
      const result = service.evaluateOrderConditions('stop', 'sell', quote, null, '150.00');
      expect(result).toEqual(new Decimal(150.0));
    });
  });

  // ── getMarketFillPrice ──

  describe('getMarketFillPrice', () => {
    const quote = makeQuote(155.25, 155.0);

    it('buy → ask price', () => {
      const result = service.getMarketFillPrice('buy', quote);
      expect(result).toEqual(new Decimal(155.25));
    });

    it('sell → bid price', () => {
      const result = service.getMarketFillPrice('sell', quote);
      expect(result).toEqual(new Decimal(155.0));
    });
  });
});
