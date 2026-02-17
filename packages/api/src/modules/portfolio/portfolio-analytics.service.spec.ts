import Decimal from 'decimal.js';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

// ── Helpers ──

function makeSnapshot(
  date: string,
  equity: string,
  cash = '50000.00',
  pv = '50000.00',
  dayPnl = '0.00',
  totalPnl = '0.00',
) {
  return {
    id: `snap-${date}`,
    cuidUserId: 'user-1',
    snapshotDate: date,
    cashBalance: cash,
    positionsValue: pv,
    totalEquity: equity,
    dayPnl,
    totalPnl,
    createdAt: new Date(`${date}T00:00:00Z`),
  };
}

function makeFill(id: string, symbol: string, side: string, qty: string, price: string, filledAt: string) {
  return {
    id,
    orderId: `order-${id}`,
    cuidUserId: 'user-1',
    symbol,
    side,
    quantity: qty,
    price,
    totalCost: new Decimal(qty).mul(price).toFixed(2),
    filledAt: new Date(filledAt),
  };
}

function mockChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.then = (resolve: (v: unknown) => unknown, reject?: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject: (v: unknown) => unknown) => Promise.resolve(result).catch(reject);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.offset = jest.fn().mockReturnValue(chain);
  chain.orderBy = jest.fn().mockReturnValue(chain);
  return chain;
}

function createMockDrizzle(snapshots: unknown[] = [], fillRows: unknown[] = []) {
  let callCount = 0;
  return {
    db: {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => {
          const current = callCount++;
          // getAnalytics: call 0 = snapshots, call 1 = fills for round trips
          // getTrades: call 0 = count, call 1 = paginated fills, call 2 = all fills for round trips
          if (current === 0) return mockChain(snapshots);
          return mockChain(fillRows);
        }),
      })),
    },
  };
}

function createMockCache() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockMarketData() {
  return {
    getBars: jest.fn().mockResolvedValue({ bars: [], symbol: 'SPY', nextPageToken: null }),
    getQuote: jest.fn(),
    getQuotes: jest.fn(),
  };
}

describe('PortfolioAnalyticsService', () => {
  let service: PortfolioAnalyticsService;
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockMarketData: ReturnType<typeof createMockMarketData>;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    mockCache = createMockCache();
    mockMarketData = createMockMarketData();
    service = new PortfolioAnalyticsService(mockDrizzle as never, mockMarketData as never, mockCache as never);
  });

  // ── History ──

  describe('getHistory', () => {
    it('returns empty snapshots when no data', async () => {
      const result = await service.getHistory('user-1', '30d');
      expect(result.period).toBe('30d');
      expect(result.interval).toBe('1d');
      expect(result.snapshots).toEqual([]);
    });

    it('computes drawdown correctly', async () => {
      mockDrizzle = createMockDrizzle([
        makeSnapshot('2026-01-01', '100000.00'),
        makeSnapshot('2026-01-02', '105000.00'),
        makeSnapshot('2026-01-03', '100000.00'),
        makeSnapshot('2026-01-04', '110000.00'),
      ]);
      service = new PortfolioAnalyticsService(mockDrizzle as never, mockMarketData as never, mockCache as never);

      const result = await service.getHistory('user-1', '30d');
      expect(result.snapshots).toHaveLength(4);
      expect(result.snapshots[0].drawdown).toBe('0.0000'); // at peak
      expect(result.snapshots[1].drawdown).toBe('0.0000'); // new peak
      // Day 3: dropped from 105k peak to 100k = -4.76%
      expect(parseFloat(result.snapshots[2].drawdown)).toBeCloseTo(-0.0476, 3);
      expect(result.snapshots[3].drawdown).toBe('0.0000'); // new peak
    });

    it('returns cached result if available', async () => {
      const cachedResult = { period: '30d' as const, interval: '1d' as const, snapshots: [] };
      mockCache.get.mockResolvedValue(cachedResult);
      const result = await service.getHistory('user-1', '30d');
      expect(result).toEqual(cachedResult);
      expect(mockDrizzle.db.select).not.toHaveBeenCalled();
    });
  });

  // ── FIFO Round-Trip Matching ──

  describe('computeRoundTripsFromFills', () => {
    it('matches simple buy-then-sell round trip', () => {
      const fills = [
        makeFill('f1', 'AAPL', 'buy', '10', '150.00', '2026-01-01T10:00:00Z'),
        makeFill('f2', 'AAPL', 'sell', '10', '160.00', '2026-01-05T10:00:00Z'),
      ];

      const matches = service.computeRoundTripsFromFills(fills);
      expect(matches).toHaveLength(1);
      expect(matches[0].symbol).toBe('AAPL');
      expect(matches[0].entryPrice.toNumber()).toBe(150);
      expect(matches[0].exitPrice.toNumber()).toBe(160);
      expect(matches[0].pnl.toNumber()).toBe(100); // (160-150) * 10
      expect(matches[0].holdingDays).toBe(4);
      expect(matches[0].side).toBe('long');
    });

    it('handles partial matches', () => {
      const fills = [
        makeFill('f1', 'AAPL', 'buy', '10', '150.00', '2026-01-01T10:00:00Z'),
        makeFill('f2', 'AAPL', 'sell', '5', '160.00', '2026-01-03T10:00:00Z'),
        makeFill('f3', 'AAPL', 'sell', '5', '170.00', '2026-01-05T10:00:00Z'),
      ];

      const matches = service.computeRoundTripsFromFills(fills);
      expect(matches).toHaveLength(2);
      expect(matches[0].quantity.toNumber()).toBe(5);
      expect(matches[0].pnl.toNumber()).toBe(50); // (160-150) * 5
      expect(matches[1].quantity.toNumber()).toBe(5);
      expect(matches[1].pnl.toNumber()).toBe(100); // (170-150) * 5
    });

    it('matches short round trips (sell first, buy to close)', () => {
      const fills = [
        makeFill('f1', 'AAPL', 'sell', '10', '160.00', '2026-01-01T10:00:00Z'),
        makeFill('f2', 'AAPL', 'buy', '10', '150.00', '2026-01-05T10:00:00Z'),
      ];

      const matches = service.computeRoundTripsFromFills(fills);
      expect(matches).toHaveLength(1);
      expect(matches[0].pnl.toNumber()).toBe(100); // (160-150) * 10 (short profit)
      expect(matches[0].side).toBe('short');
    });

    it('handles multiple symbols independently', () => {
      const fills = [
        makeFill('f1', 'AAPL', 'buy', '10', '150.00', '2026-01-01T10:00:00Z'),
        makeFill('f2', 'MSFT', 'buy', '5', '300.00', '2026-01-01T10:00:00Z'),
        makeFill('f3', 'AAPL', 'sell', '10', '160.00', '2026-01-05T10:00:00Z'),
        makeFill('f4', 'MSFT', 'sell', '5', '310.00', '2026-01-05T10:00:00Z'),
      ];

      const matches = service.computeRoundTripsFromFills(fills);
      expect(matches).toHaveLength(2);
      const aapl = matches.find((m) => m.symbol === 'AAPL');
      const msft = matches.find((m) => m.symbol === 'MSFT');
      expect(aapl!.pnl.toNumber()).toBe(100);
      expect(msft!.pnl.toNumber()).toBe(50);
    });

    it('returns empty array for no fills', () => {
      const matches = service.computeRoundTripsFromFills([]);
      expect(matches).toEqual([]);
    });

    it('returns empty when only opening fills exist (no closes)', () => {
      const fills = [makeFill('f1', 'AAPL', 'buy', '10', '150.00', '2026-01-01T10:00:00Z')];
      const matches = service.computeRoundTripsFromFills(fills);
      expect(matches).toEqual([]);
    });
  });

  // ── Analytics ──

  describe('getAnalytics', () => {
    it('returns zero/null values for empty snapshots', async () => {
      const result = await service.getAnalytics('user-1', 'all', 'SPY');
      expect(result.startingEquity).toBe('0.00');
      expect(result.endingEquity).toBe('0.00');
      expect(result.returns.totalReturn).toBe('0.0000');
      expect(result.risk.sharpeRatio).toBeNull();
      expect(result.risk.maxDrawdown).toBe('0.0000');
      expect(result.trading.totalTrades).toBe(0);
      expect(result.benchmark).toBeNull();
    });

    it('returns cached result if available', async () => {
      const cachedResult = { period: 'all', cached: true };
      mockCache.get.mockResolvedValue(cachedResult);
      const result = await service.getAnalytics('user-1', 'all', 'SPY');
      expect(result).toEqual(cachedResult);
    });

    it('computes return metrics from known equity series', async () => {
      const snaps = [
        makeSnapshot('2026-01-01', '100000.00'),
        makeSnapshot('2026-01-02', '101000.00'),
        makeSnapshot('2026-01-03', '102010.00'),
        makeSnapshot('2026-01-06', '100000.00'),
        makeSnapshot('2026-01-07', '103030.30'),
        makeSnapshot('2026-01-08', '105000.00'),
      ];
      mockDrizzle = createMockDrizzle(snaps);
      service = new PortfolioAnalyticsService(mockDrizzle as never, mockMarketData as never, mockCache as never);

      const result = await service.getAnalytics('user-1', 'all', 'SPY');
      expect(result.startingEquity).toBe('100000.00');
      expect(result.endingEquity).toBe('105000.00');
      expect(parseFloat(result.returns.totalReturn)).toBeCloseTo(0.05, 3);
      // Should have daily returns computed
      expect(result.returns.dailyReturns.positive).toBeGreaterThan(0);
    });

    it('sets risk ratios to null with < 5 snapshots', async () => {
      const snaps = [
        makeSnapshot('2026-01-01', '100000.00'),
        makeSnapshot('2026-01-02', '101000.00'),
        makeSnapshot('2026-01-03', '102000.00'),
      ];
      mockDrizzle = createMockDrizzle(snaps);
      service = new PortfolioAnalyticsService(mockDrizzle as never, mockMarketData as never, mockCache as never);

      const result = await service.getAnalytics('user-1', 'all', 'SPY');
      // Only 2 daily returns (from 3 snapshots) — below MIN_DAYS_FOR_RATIOS
      expect(result.risk.sharpeRatio).toBeNull();
      expect(result.risk.sortinoRatio).toBeNull();
      expect(result.risk.valueAtRisk95).toBeNull();
    });

    it('handles all-cash (constant equity) correctly', async () => {
      const snaps = [
        makeSnapshot('2026-01-01', '100000.00'),
        makeSnapshot('2026-01-02', '100000.00'),
        makeSnapshot('2026-01-03', '100000.00'),
        makeSnapshot('2026-01-06', '100000.00'),
        makeSnapshot('2026-01-07', '100000.00'),
        makeSnapshot('2026-01-08', '100000.00'),
      ];
      mockDrizzle = createMockDrizzle(snaps);
      service = new PortfolioAnalyticsService(mockDrizzle as never, mockMarketData as never, mockCache as never);

      const result = await service.getAnalytics('user-1', 'all', 'SPY');
      expect(result.returns.totalReturn).toBe('0.0000');
      expect(result.risk.volatility).toBe('0.0000');
      // Sharpe should be null because stdDev is 0
      expect(result.risk.sharpeRatio).toBeNull();
    });
  });
});
