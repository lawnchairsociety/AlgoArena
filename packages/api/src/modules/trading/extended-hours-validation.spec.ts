import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderDto } from './dto/place-order.dto';
import { TradingService } from './trading.service';

describe('TradingService — extended hours validation', () => {
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

  const validate = (dto: Partial<PlaceOrderDto>) =>
    (service as any).validateExtendedHoursConstraints(dto as PlaceOrderDto);

  // ── Accepted combinations ──

  it('accepts limit + day + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'day',
      }),
    ).not.toThrow();
  });

  it('accepts limit + gtc + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'gtc',
      }),
    ).not.toThrow();
  });

  // ── Order type rejections ──

  it('rejects market + extendedHours', () => {
    expect(() =>
      validate({
        type: 'market',
        timeInForce: 'day',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects stop + extendedHours', () => {
    expect(() =>
      validate({
        type: 'stop',
        timeInForce: 'day',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects stop_limit + extendedHours', () => {
    expect(() =>
      validate({
        type: 'stop_limit',
        timeInForce: 'day',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailing_stop + extendedHours', () => {
    expect(() =>
      validate({
        type: 'trailing_stop',
        timeInForce: 'day',
      }),
    ).toThrow(BadRequestException);
  });

  // ── TIF rejections ──

  it('rejects ioc + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'ioc',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects fok + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'fok',
      }),
    ).toThrow(BadRequestException);
  });

  // ── Bracket rejection ──

  it('rejects bracket + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'day',
        bracket: {
          takeProfit: { limitPrice: '200.00' },
        },
      }),
    ).toThrow(BadRequestException);
  });

  // ── Trailing stop params rejection ──

  it('rejects trailPercent + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'day',
        trailPercent: '3.0',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects trailPrice + extendedHours', () => {
    expect(() =>
      validate({
        type: 'limit',
        timeInForce: 'day',
        trailPrice: '5.00',
      }),
    ).toThrow(BadRequestException);
  });
});
