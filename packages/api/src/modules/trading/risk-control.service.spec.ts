import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { RiskControlService, RiskValidationParams } from './risk-control.service';
import { RISK_PROFILE_PRESETS } from './risk-profiles';

// Helper: creates a mock that works as both an awaitable array AND a chainable builder
function mockQueryBuilder(result: any[] = []) {
  const resolved = Promise.resolve(result);
  const builder: any = Object.assign(resolved, {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue(resolved),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnValue(resolved),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  });
  return builder;
}

describe('RiskControlService', () => {
  let service: RiskControlService;
  let mockDrizzle: any;
  let mockEventEmitter: any;

  const mockUser = {
    id: 'test-user',
    cashBalance: '100000.00',
    startingBalance: '100000.00',
    marginUsed: '0.00',
    pdtEnforced: false,
    apiKeyId: 'test-key',
    label: 'test',
    createdAt: new Date(),
  };

  const mockQuote = {
    timestamp: new Date().toISOString(),
    askPrice: 150,
    askSize: 100,
    bidPrice: 149,
    bidSize: 100,
  };

  const baseParams: RiskValidationParams = {
    dto: {
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      quantity: '10',
      timeInForce: 'day',
    },
    user: mockUser as any,
    existingPosition: null,
    quote: mockQuote,
    totalEquity: new Decimal('100000'),
    isOption: false,
    isCrypto: false,
    effectiveMultiplier: 1,
  };

  function setupMocks(controls: any = null, positionsResult: any[] = []) {
    const controlsResult = controls ? [controls] : [];

    mockDrizzle = {
      db: {
        select: jest.fn().mockImplementation(() => mockQueryBuilder(controlsResult)),
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockResolvedValue([]),
        }),
      },
    };

    // Track call count to return different results for different queries
    let selectCallCount = 0;
    mockDrizzle.db.select = jest.fn().mockImplementation(() => {
      selectCallCount++;
      // 1st call: getControls query
      if (selectCallCount === 1) return mockQueryBuilder(controlsResult);
      // Subsequent calls: position count, daily fills, positions list, etc.
      return mockQueryBuilder(positionsResult);
    });

    mockEventEmitter = { emit: jest.fn() };
    service = new RiskControlService(mockDrizzle, mockEventEmitter);
  }

  describe('getControls', () => {
    it('returns defaults when no row exists', async () => {
      setupMocks(null);
      const controls = await service.getControls('test-user');

      expect(controls.maxPositionPct).toBe('0.2500');
      expect(controls.maxPositions).toBe(50);
      expect(controls.maxDailyTrades).toBe(100);
      expect(controls.maxPriceDeviationPct).toBe('0.1000');
      expect(controls.shortSellingEnabled).toBe(true);
      expect(controls.maxShortExposurePct).toBe('0.5000');
      expect(controls.maxSingleShortPct).toBe('0.1500');
      expect(controls.autoFlattenOnLoss).toBe(false);
    });

    it('returns stored controls when row exists', async () => {
      setupMocks({
        maxPositionPct: '0.1500',
        maxPositionValue: null,
        maxPositions: 20,
        maxOrderValue: '5000.00',
        maxOrderQuantity: null,
        maxPriceDeviationPct: '0.0500',
        maxDailyTrades: 25,
        maxDailyNotional: null,
        maxDailyLossPct: '0.0300',
        maxDrawdownPct: null,
        autoFlattenOnLoss: true,
        shortSellingEnabled: false,
        maxShortExposurePct: '0.0000',
        maxSingleShortPct: '0.0000',
      });

      const controls = await service.getControls('test-user');
      expect(controls.maxPositionPct).toBe('0.1500');
      expect(controls.maxPositions).toBe(20);
      expect(controls.shortSellingEnabled).toBe(false);
      expect(controls.autoFlattenOnLoss).toBe(true);
    });
  });

  describe('risk profiles', () => {
    it('conservative profile disables short selling', () => {
      const p = RISK_PROFILE_PRESETS.conservative;
      expect(p.shortSellingEnabled).toBe(false);
      expect(p.maxPositionPct).toBe('0.1500');
      expect(p.maxPositions).toBe(20);
      expect(p.maxDailyTrades).toBe(20);
      expect(p.autoFlattenOnLoss).toBe(true);
    });

    it('unrestricted profile has all null limits', () => {
      const p = RISK_PROFILE_PRESETS.unrestricted;
      expect(p.maxPositionPct).toBeNull();
      expect(p.maxPositions).toBeNull();
      expect(p.maxDailyTrades).toBeNull();
      expect(p.maxDailyLossPct).toBeNull();
      expect(p.shortSellingEnabled).toBe(true);
      expect(p.maxShortExposurePct).toBeNull();
    });

    it('moderate profile has intermediate limits', () => {
      const p = RISK_PROFILE_PRESETS.moderate;
      expect(p.maxPositionPct).toBe('0.2500');
      expect(p.maxPositions).toBe(50);
      expect(p.maxDailyTrades).toBe(50);
      expect(p.shortSellingEnabled).toBe(true);
    });

    it('aggressive profile has higher limits', () => {
      const p = RISK_PROFILE_PRESETS.aggressive;
      expect(p.maxPositionPct).toBe('0.4000');
      expect(p.maxPositions).toBe(100);
      expect(p.maxDailyTrades).toBe(100);
    });
  });

  describe('validateOrder — position concentration', () => {
    it('rejects when position would exceed maxPositionPct', async () => {
      // 300 shares * $150 = $45,000 = 45% of $100k equity, exceeds default 25%
      setupMocks(null); // defaults: maxPositionPct = 0.25
      const params = {
        ...baseParams,
        dto: { ...baseParams.dto, quantity: '300' },
      };

      await expect(service.validateOrder('test-user', params)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOrder — order size', () => {
    it('rejects when order value exceeds maxOrderValue', async () => {
      // order is 10 * $150 = $1500, but maxOrderValue = $1000
      setupMocks({
        maxPositionPct: null,
        maxPositionValue: null,
        maxPositions: null,
        maxOrderValue: '1000.00',
        maxOrderQuantity: null,
        maxPriceDeviationPct: null,
        maxDailyTrades: null,
        maxDailyNotional: null,
        maxDailyLossPct: null,
        maxDrawdownPct: null,
        autoFlattenOnLoss: false,
        shortSellingEnabled: true,
        maxShortExposurePct: null,
        maxSingleShortPct: null,
      });

      await expect(service.validateOrder('test-user', baseParams)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOrder — price deviation', () => {
    it('rejects when limit price deviates too much', async () => {
      // $200 vs midpoint of ~$149.50 = ~33.8% deviation, exceeds default 10%
      setupMocks(null); // defaults: maxPriceDeviationPct = 0.10
      const params = {
        ...baseParams,
        dto: { ...baseParams.dto, type: 'limit' as const, limitPrice: '200.00' },
      };

      await expect(service.validateOrder('test-user', params)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOrder — short selling disabled', () => {
    it('rejects short sell when shortSellingEnabled is false', async () => {
      setupMocks({
        maxPositionPct: null,
        maxPositionValue: null,
        maxPositions: null,
        maxOrderValue: null,
        maxOrderQuantity: null,
        maxPriceDeviationPct: null,
        maxDailyTrades: null,
        maxDailyNotional: null,
        maxDailyLossPct: null,
        maxDrawdownPct: null,
        autoFlattenOnLoss: false,
        shortSellingEnabled: false,
        maxShortExposurePct: '0.0000',
        maxSingleShortPct: '0.0000',
      });

      const params = {
        ...baseParams,
        dto: { ...baseParams.dto, side: 'sell' as const },
      };

      await expect(service.validateOrder('test-user', params)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateOrder — options and crypto bypass short checks', () => {
    it('allows option sell without short sell check', async () => {
      setupMocks({
        maxPositionPct: null,
        maxPositionValue: null,
        maxPositions: null,
        maxOrderValue: null,
        maxOrderQuantity: null,
        maxPriceDeviationPct: null,
        maxDailyTrades: null,
        maxDailyNotional: null,
        maxDailyLossPct: null,
        maxDrawdownPct: null,
        autoFlattenOnLoss: false,
        shortSellingEnabled: false,
        maxShortExposurePct: null,
        maxSingleShortPct: null,
      });

      const params: RiskValidationParams = {
        ...baseParams,
        dto: { ...baseParams.dto, side: 'sell' as const },
        isOption: true,
      };

      // Should NOT throw (options bypass short selling checks)
      await expect(service.validateOrder('test-user', params)).resolves.toBeUndefined();
    });

    it('allows crypto sell without short sell check', async () => {
      setupMocks({
        maxPositionPct: null,
        maxPositionValue: null,
        maxPositions: null,
        maxOrderValue: null,
        maxOrderQuantity: null,
        maxPriceDeviationPct: null,
        maxDailyTrades: null,
        maxDailyNotional: null,
        maxDailyLossPct: null,
        maxDrawdownPct: null,
        autoFlattenOnLoss: false,
        shortSellingEnabled: false,
        maxShortExposurePct: null,
        maxSingleShortPct: null,
      });

      const params: RiskValidationParams = {
        ...baseParams,
        dto: { ...baseParams.dto, side: 'sell' as const },
        isCrypto: true,
      };

      await expect(service.validateOrder('test-user', params)).resolves.toBeUndefined();
    });
  });

  describe('auto-flatten event emission', () => {
    it('emits auto_flatten event when daily loss exceeds limit with autoFlattenOnLoss', async () => {
      setupMocks({
        maxPositionPct: null,
        maxPositionValue: null,
        maxPositions: null,
        maxOrderValue: null,
        maxOrderQuantity: null,
        maxPriceDeviationPct: null,
        maxDailyTrades: null,
        maxDailyNotional: null,
        maxDailyLossPct: '0.0500', // 5% loss limit
        maxDrawdownPct: null,
        autoFlattenOnLoss: true,
        shortSellingEnabled: true,
        maxShortExposurePct: null,
        maxSingleShortPct: null,
      });

      const params = {
        ...baseParams,
        user: { ...mockUser, startingBalance: '100000.00' } as any,
        totalEquity: new Decimal('90000'), // 10% loss
      };

      await expect(service.validateOrder('test-user', params)).rejects.toThrow(BadRequestException);

      // Check that auto_flatten event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'risk.auto_flatten',
        expect.objectContaining({
          cuidUserId: 'test-user',
          controlName: 'maxDailyLossPct',
        }),
      );
    });
  });

  describe('recordEvent', () => {
    it('inserts event into risk_events table', async () => {
      setupMocks(null);
      await service.recordEvent('test-user', 'order_rejected', 'maxPositionPct', 'Test message', { key: 'value' });
      expect(mockDrizzle.db.insert).toHaveBeenCalled();
    });
  });
});
