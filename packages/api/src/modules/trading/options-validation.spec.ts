import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService — options validation', () => {
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
    );
  });

  const validate = (dto: Partial<PlaceOrderDto>) => (service as any).validateOptionsConstraints(dto as PlaceOrderDto);

  // ── Order type restrictions ──

  it('accepts market order for options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1',
      }),
    ).not.toThrow();
  });

  it('accepts limit order for options', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'gtc',
        quantity: '5',
      }),
    ).not.toThrow();
  });

  it('rejects stop order for options', () => {
    expect(() =>
      validate({
        type: 'stop',
        timeInForce: 'day',
        quantity: '1',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects stop_limit order for options', () => {
    expect(() =>
      validate({
        type: 'stop_limit',
        timeInForce: 'day',
        quantity: '1',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailing_stop order for options', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        timeInForce: 'day',
        quantity: '1',
      }),
    ).toThrow(BadRequestException);
  });

  // ── Time in force restrictions ──

  it('accepts day time-in-force for options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1',
      }),
    ).not.toThrow();
  });

  it('accepts gtc time-in-force for options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'gtc',
        quantity: '1',
      }),
    ).not.toThrow();
  });

  it('rejects ioc time-in-force for options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'ioc',
        quantity: '1',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects fok time-in-force for options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'fok',
        quantity: '1',
      }),
    ).toThrow(BadRequestException);
  });

  // ── Fractional quantity ──

  it('accepts whole number quantity', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '10',
      }),
    ).not.toThrow();
  });

  it('rejects fractional quantity', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1.5',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects very small fractional quantity', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '0.001',
      }),
    ).toThrow(BadRequestException);
  });

  // ── Trailing stop params ──

  it('rejects trailPercent on options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1',
        trailPercent: '3.0',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailPrice on options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1',
        trailPrice: '5.00',
      }),
    ).toThrow(BadRequestException);
  });

  // ── Bracket ──

  it('rejects bracket on options', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
        quantity: '1',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
        },
      }),
    ).toThrow(BadRequestException);
  });
});
