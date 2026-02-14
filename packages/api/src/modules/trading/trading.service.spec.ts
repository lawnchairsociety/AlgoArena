import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService', () => {
  let service: TradingService;

  beforeEach(() => {
    // validateOrderDto is pure — no injected deps used
    service = new TradingService(null as any, null as any, null as any, null as any, null as any, null as any);
  });

  const validate = (dto: Partial<PlaceOrderDto>) => (service as any).validateOrderDto(dto as PlaceOrderDto);

  // ── validateOrderDto ──

  describe('validateOrderDto', () => {
    it('valid market order → no throw', () => {
      expect(() =>
        validate({ type: 'market', side: 'buy', quantity: '10', symbol: 'AAPL', timeInForce: 'day' }),
      ).not.toThrow();
    });

    it('valid limit order → no throw', () => {
      expect(() =>
        validate({
          type: 'limit',
          side: 'buy',
          quantity: '10',
          limitPrice: '150.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).not.toThrow();
    });

    it('valid stop order → no throw', () => {
      expect(() =>
        validate({
          type: 'stop',
          side: 'sell',
          quantity: '5',
          stopPrice: '140.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).not.toThrow();
    });

    it('valid stop-limit order → no throw', () => {
      expect(() =>
        validate({
          type: 'stop_limit',
          side: 'buy',
          quantity: '5',
          limitPrice: '155.00',
          stopPrice: '150.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).not.toThrow();
    });

    it('quantity <= 0 → throws', () => {
      expect(() =>
        validate({ type: 'market', side: 'buy', quantity: '0', symbol: 'AAPL', timeInForce: 'day' }),
      ).toThrow(BadRequestException);
    });

    it('negative quantity → throws', () => {
      expect(() =>
        validate({ type: 'market', side: 'buy', quantity: '-5', symbol: 'AAPL', timeInForce: 'day' }),
      ).toThrow(BadRequestException);
    });

    it('market order with limitPrice → throws', () => {
      expect(() =>
        validate({
          type: 'market',
          side: 'buy',
          quantity: '10',
          limitPrice: '150.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).toThrow(BadRequestException);
    });

    it('market order with stopPrice → throws', () => {
      expect(() =>
        validate({
          type: 'market',
          side: 'sell',
          quantity: '10',
          stopPrice: '140.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).toThrow(BadRequestException);
    });

    it('limit order without limitPrice → throws', () => {
      expect(() =>
        validate({ type: 'limit', side: 'buy', quantity: '10', symbol: 'AAPL', timeInForce: 'day' }),
      ).toThrow(BadRequestException);
    });

    it('stop order without stopPrice → throws', () => {
      expect(() => validate({ type: 'stop', side: 'sell', quantity: '5', symbol: 'AAPL', timeInForce: 'day' })).toThrow(
        BadRequestException,
      );
    });

    it('stop-limit without limitPrice → throws', () => {
      expect(() =>
        validate({
          type: 'stop_limit',
          side: 'buy',
          quantity: '5',
          stopPrice: '150.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).toThrow(BadRequestException);
    });

    it('stop-limit without stopPrice → throws', () => {
      expect(() =>
        validate({
          type: 'stop_limit',
          side: 'buy',
          quantity: '5',
          limitPrice: '155.00',
          symbol: 'AAPL',
          timeInForce: 'day',
        }),
      ).toThrow(BadRequestException);
    });

    it('limitPrice <= 0 → throws', () => {
      expect(() =>
        validate({ type: 'limit', side: 'buy', quantity: '10', limitPrice: '0', symbol: 'AAPL', timeInForce: 'day' }),
      ).toThrow(BadRequestException);
    });

    it('stopPrice <= 0 → throws', () => {
      expect(() =>
        validate({ type: 'stop', side: 'sell', quantity: '5', stopPrice: '-1', symbol: 'AAPL', timeInForce: 'day' }),
      ).toThrow(BadRequestException);
    });
  });
});
