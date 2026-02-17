import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService — bracket validation', () => {
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

  const validate = (dto: Partial<PlaceOrderDto>) => (service as any).validateOrderDto(dto as PlaceOrderDto);

  // ── accepts valid brackets ──

  it('accepts valid bracket with TP + SL', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
          stopLoss: { stopPrice: '170.00' },
        },
      }),
    ).not.toThrow();
  });

  it('accepts bracket with TP only', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
        },
      }),
    ).not.toThrow();
  });

  it('accepts bracket with SL only', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          stopLoss: { stopPrice: '170.00' },
        },
      }),
    ).not.toThrow();
  });

  // ── rejects invalid brackets ──

  it('rejects bracket on trailing_stop entry type', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'gtc',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
        },
      }),
    ).toThrow(/trailing_stop/);
  });

  it('rejects empty bracket (no TP and no SL)', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {},
      }),
    ).toThrow(/at least/);
  });

  it('rejects bracket.takeProfit.limitPrice <= 0', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '0' },
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects bracket.stopLoss.stopPrice <= 0', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          stopLoss: { stopPrice: '-1' },
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects buy bracket where TP <= SL', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '170.00' },
          stopLoss: { stopPrice: '180.00' },
        },
      }),
    ).toThrow(/buy bracket/);
  });

  it('rejects sell bracket where TP >= SL', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'sell',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
          stopLoss: { stopPrice: '170.00' },
        },
      }),
    ).toThrow(/sell bracket/);
  });

  it('rejects bracket combined with ocoLinkedTo', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
        },
        ocoLinkedTo: '00000000-0000-0000-0000-000000000000',
      }),
    ).toThrow(/bracket.*ocoLinkedTo|ocoLinkedTo.*bracket/i);
  });
});
