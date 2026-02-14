import { NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { cuidUsers, positions } from '../database/schema';
import type { Quote } from '../market-data/types/market-data-provider.types';
import { PortfolioService } from './portfolio.service';

// ── Helpers ──

function makeQuote(ask: number, bid: number): Quote {
  return { timestamp: '2026-01-15T10:00:00Z', askPrice: ask, askSize: 100, bidPrice: bid, bidSize: 100 };
}

function makeUser(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'test-user-1',
    apiKeyId: 'key-1',
    label: null,
    startingBalance: '100000.00',
    cashBalance: '100000.00',
    marginUsed: '0.00',
    pdtEnforced: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function makePosition(symbol: string, quantity: string, avgCostBasis: string) {
  return {
    id: `test-user-1:${symbol}`,
    cuidUserId: 'test-user-1',
    symbol,
    quantity,
    avgCostBasis,
    totalCostBasis: new Decimal(quantity).abs().mul(avgCostBasis).toFixed(2),
    updatedAt: new Date(),
  };
}

/** Create a chainable mock that resolves to `result` when awaited. */
function mockChain(result: any[]) {
  const chain: any = {};
  chain.then = (resolve: Function, reject?: Function) => Promise.resolve(result).then(resolve as any, reject as any);
  chain.catch = (reject: Function) => Promise.resolve(result).catch(reject as any);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.orderBy = jest.fn().mockReturnValue(chain);
  return chain;
}

interface MockDbConfig {
  users?: any[];
  positions?: any[];
}

function createMockDrizzle(config: MockDbConfig) {
  return {
    db: {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          if (table === cuidUsers) return mockChain(config.users ?? []);
          if (table === positions) return mockChain(config.positions ?? []);
          return mockChain([]);
        }),
      })),
    },
  };
}

describe('PortfolioService', () => {
  // ── getAccountSummary ──

  describe('getAccountSummary', () => {
    it('user not found → throws NotFoundException', async () => {
      const drizzle = createMockDrizzle({ users: [] });
      const service = new PortfolioService(drizzle as any, null as any, null as any);

      await expect(service.getAccountSummary('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('no positions → positionsValue=0, equity=cash, totalPnl=cash-startingBalance', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '95000.00' })],
        positions: [],
      });
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(0) };
      const service = new PortfolioService(drizzle as any, null as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      expect(result.positionsValue).toBe('0.00');
      expect(result.totalEquity).toBe('95000.00');
      expect(result.totalPnl).toBe('-5000.00');
      expect(result.unrealizedPnl).toBe('0.00');
    });

    it('long position with quote → bid-based valuation, correct unrealizedPnl', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '85000.00' })],
        positions: [makePosition('AAPL', '100.000000', '150.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({ AAPL: makeQuote(156.0, 155.0) }),
      };
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(0) };
      const service = new PortfolioService(drizzle as any, marketData as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      // 100 shares * bid 155 = 15500
      expect(result.positionsValue).toBe('15500.00');
      // equity = 85000 + 15500 = 100500
      expect(result.totalEquity).toBe('100500.00');
      // unrealizedPnl = (155 - 150) * 100 = 500
      expect(result.unrealizedPnl).toBe('500.00');
    });

    it('short position with quote → ask-based valuation, correct unrealizedPnl', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '100000.00', marginUsed: '7500.00' })],
        positions: [makePosition('TSLA', '-50.000000', '200.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({ TSLA: makeQuote(190.0, 189.0) }),
      };
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(0) };
      const service = new PortfolioService(drizzle as any, marketData as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      // short: -50 * ask 190 = -9500 (negative, as expected for shorts)
      expect(result.positionsValue).toBe('-9500.00');
      // equity = 100000 + (-9500) = 90500
      expect(result.totalEquity).toBe('90500.00');
      // unrealizedPnl = (190 - 200) * (-50) = (-10)*(-50) = 500 (profit because price went down)
      expect(result.unrealizedPnl).toBe('500.00');
    });

    it('mixed long+short positions → both priced correctly', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '80000.00' })],
        positions: [makePosition('AAPL', '100.000000', '150.0000'), makePosition('TSLA', '-20.000000', '300.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({
          AAPL: makeQuote(156.0, 155.0),
          TSLA: makeQuote(310.0, 309.0),
        }),
      };
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(0) };
      const service = new PortfolioService(drizzle as any, marketData as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      // AAPL: 100 * bid 155 = 15500
      // TSLA: -20 * ask 310 = -6200
      // positionsValue = 15500 + (-6200) = 9300
      expect(result.positionsValue).toBe('9300.00');
      // equity = 80000 + 9300 = 89300
      expect(result.totalEquity).toBe('89300.00');
      // AAPL pnl: (155-150)*100 = 500
      // TSLA pnl: (310-300)*(-20) = -200 (loss because price went up on short)
      // total unrealized = 300
      expect(result.unrealizedPnl).toBe('300.00');
    });

    it('position with missing quote → skipped in valuation', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '85000.00' })],
        positions: [makePosition('AAPL', '100.000000', '150.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({}), // no quote returned
      };
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(0) };
      const service = new PortfolioService(drizzle as any, marketData as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      expect(result.positionsValue).toBe('0.00');
      expect(result.totalEquity).toBe('85000.00');
      expect(result.unrealizedPnl).toBe('0.00');
    });

    it('PDT restricted: pdtEnforced + 3 day trades + equity < $25k → true', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '20000.00', pdtEnforced: true })],
        positions: [],
      });
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(3) };
      const service = new PortfolioService(drizzle as any, null as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      expect(result.pdtRestricted).toBe(true);
    });

    it('PDT not restricted: pdtEnforced + 3 day trades + equity >= $25k → false', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '30000.00', pdtEnforced: true })],
        positions: [],
      });
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(3) };
      const service = new PortfolioService(drizzle as any, null as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      expect(result.pdtRestricted).toBe(false);
    });

    it('PDT not restricted: pdtEnforced=false → always false', async () => {
      const drizzle = createMockDrizzle({
        users: [makeUser({ cashBalance: '5000.00', pdtEnforced: false })],
        positions: [],
      });
      const pdtService = { countDayTradesInWindow: jest.fn().mockResolvedValue(5) };
      const service = new PortfolioService(drizzle as any, null as any, pdtService as any);

      const result = await service.getAccountSummary('test-user-1');

      expect(result.pdtRestricted).toBe(false);
    });
  });

  // ── getPositions ──

  describe('getPositions', () => {
    it('empty positions → returns []', async () => {
      const drizzle = createMockDrizzle({ positions: [] });
      const service = new PortfolioService(drizzle as any, null as any, null as any);

      const result = await service.getPositions('test-user-1');

      expect(result).toEqual([]);
    });

    it('long position → side=long, bid-based currentPrice, correct PnL', async () => {
      const drizzle = createMockDrizzle({
        positions: [makePosition('AAPL', '50.000000', '145.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({ AAPL: makeQuote(152.0, 150.0) }),
      };
      const service = new PortfolioService(drizzle as any, marketData as any, null as any);

      const result = await service.getPositions('test-user-1');

      expect(result).toHaveLength(1);
      expect(result[0].side).toBe('long');
      expect(result[0].currentPrice).toBe('150.0000');
      // marketValue = 50 * 150 = 7500
      expect(result[0].marketValue).toBe('7500.00');
      // unrealizedPnl = (150 - 145) * 50 = 250
      expect(result[0].unrealizedPnl).toBe('250.00');
    });

    it('short position → side=short, ask-based currentPrice, correct PnL', async () => {
      const drizzle = createMockDrizzle({
        positions: [makePosition('TSLA', '-30.000000', '200.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({ TSLA: makeQuote(195.0, 194.0) }),
      };
      const service = new PortfolioService(drizzle as any, marketData as any, null as any);

      const result = await service.getPositions('test-user-1');

      expect(result).toHaveLength(1);
      expect(result[0].side).toBe('short');
      expect(result[0].currentPrice).toBe('195.0000');
      // marketValue = -30 * 195 = -5850
      expect(result[0].marketValue).toBe('-5850.00');
      // unrealizedPnl = (195 - 200) * (-30) = (-5)*(-30) = 150 (profit)
      expect(result[0].unrealizedPnl).toBe('150.00');
    });

    it('missing quote → currentPrice=0, marketValue=0, unrealizedPnl=0', async () => {
      const drizzle = createMockDrizzle({
        positions: [makePosition('XYZ', '10.000000', '50.0000')],
      });
      const marketData = {
        getQuotes: jest.fn().mockResolvedValue({}),
      };
      const service = new PortfolioService(drizzle as any, marketData as any, null as any);

      const result = await service.getPositions('test-user-1');

      expect(result).toHaveLength(1);
      expect(result[0].currentPrice).toBe('0.0000');
      expect(result[0].marketValue).toBe('0.00');
      expect(result[0].unrealizedPnl).toBe('0.00');
    });
  });
});
