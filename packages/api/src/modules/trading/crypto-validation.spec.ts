import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService — crypto validation', () => {
  let service: TradingService;

  beforeEach(() => {
    service = new TradingService(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );
  });

  const validateCrypto = (dto: Partial<PlaceOrderDto>) =>
    (service as any).validateCryptoConstraints(dto as PlaceOrderDto);

  // ── validateCryptoConstraints ──

  describe('validateCryptoConstraints', () => {
    it('market + gtc → no throw', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'gtc' })).not.toThrow();
    });

    it('market + ioc → no throw', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'ioc' })).not.toThrow();
    });

    it('limit + gtc → no throw', () => {
      expect(() => validateCrypto({ type: 'limit', timeInForce: 'gtc' })).not.toThrow();
    });

    it('stop_limit + ioc → no throw', () => {
      expect(() => validateCrypto({ type: 'stop_limit', timeInForce: 'ioc' })).not.toThrow();
    });

    it('stop order type → throws', () => {
      expect(() => validateCrypto({ type: 'stop', timeInForce: 'gtc' })).toThrow(BadRequestException);
    });

    it('stop order type → error mentions "stop"', () => {
      expect(() => validateCrypto({ type: 'stop', timeInForce: 'gtc' })).toThrow(/stop/);
    });

    it('day TIF → throws', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'day' })).toThrow(BadRequestException);
    });

    it('day TIF → error mentions "day"', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'day' })).toThrow(/day/);
    });

    it('fok TIF → throws', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'fok' })).toThrow(BadRequestException);
    });

    it('fok TIF → error mentions "fok"', () => {
      expect(() => validateCrypto({ type: 'market', timeInForce: 'fok' })).toThrow(/fok/);
    });

    it('stop type + day TIF → throws on type first', () => {
      expect(() => validateCrypto({ type: 'stop', timeInForce: 'day' })).toThrow(/stop/);
    });
  });
});
