import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService — trailing stop validation', () => {
  let service: TradingService;

  beforeEach(() => {
    service = new TradingService(null as any, null as any, null as any, null as any, null as any, null as any);
  });

  const validate = (dto: Partial<PlaceOrderDto>) => (service as any).validateOrderDto(dto as PlaceOrderDto);

  // ── trailing_stop rules ──

  it('rejects buy-side trailing stop', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'buy',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('buy-side error mentions sell', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'buy',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      }),
    ).toThrow(/sell/);
  });

  it('requires at least one of trailPercent or trailPrice', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        timeInForce: 'gtc',
      }),
    ).toThrow(/trailPercent or trailPrice/);
  });

  it('rejects both trailPercent and trailPrice', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        trailPrice: '5.00',
        timeInForce: 'gtc',
      }),
    ).toThrow(/only one/i);
  });

  it('rejects trailPercent > 50', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '51',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailPercent <= 0', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '0',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects negative trailPercent', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '-1',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailPrice <= 0', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPrice: '0',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects negative trailPrice', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPrice: '-5',
        timeInForce: 'gtc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects IOC time-in-force', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'ioc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects FOK time-in-force', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'fok',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects limitPrice on trailing_stop', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        limitPrice: '150.00',
        timeInForce: 'gtc',
      }),
    ).toThrow(/limitPrice/);
  });

  it('rejects stopPrice on trailing_stop', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        stopPrice: '145.00',
        timeInForce: 'gtc',
      }),
    ).toThrow(/stopPrice/);
  });

  it('accepts valid trailing stop with trailPercent', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'gtc',
      }),
    ).not.toThrow();
  });

  it('accepts valid trailing stop with trailPrice', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPrice: '5.00',
        timeInForce: 'day',
      }),
    ).not.toThrow();
  });

  it('accepts trailPercent = 50 (boundary)', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        side: 'sell',
        quantity: '10',
        trailPercent: '50',
        timeInForce: 'gtc',
      }),
    ).not.toThrow();
  });

  // ── non-trailing_stop orders reject trail fields ──

  it('rejects trailPercent on market orders', () => {
    expect(() =>
      validate({
        type: 'market',
        side: 'buy',
        quantity: '10',
        trailPercent: '3.0',
        timeInForce: 'day',
      }),
    ).toThrow(/trailPercent/);
  });

  it('rejects trailPrice on limit orders', () => {
    expect(() =>
      validate({
        type: 'limit',
        side: 'buy',
        quantity: '10',
        limitPrice: '150.00',
        trailPrice: '5.00',
        timeInForce: 'day',
      }),
    ).toThrow(/trailPrice/);
  });
});
