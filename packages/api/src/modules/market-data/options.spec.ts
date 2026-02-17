import { isOptionSymbol, parseOptionSymbol } from '@algoarena/shared';

describe('isOptionSymbol', () => {
  it('returns true for valid OCC call symbol', () => {
    expect(isOptionSymbol('AAPL260320C00230000')).toBe(true);
  });

  it('returns true for valid OCC put symbol', () => {
    expect(isOptionSymbol('AAPL260320P00230000')).toBe(true);
  });

  it('returns true for 1-char underlying', () => {
    expect(isOptionSymbol('F260320C00015000')).toBe(true);
  });

  it('returns true for 6-char underlying', () => {
    expect(isOptionSymbol('GOOGLL260320C00150000')).toBe(true);
  });

  it('returns true for lowercase (case-insensitive)', () => {
    expect(isOptionSymbol('aapl260320c00230000')).toBe(true);
  });

  it('returns false for equity symbols', () => {
    expect(isOptionSymbol('AAPL')).toBe(false);
    expect(isOptionSymbol('MSFT')).toBe(false);
  });

  it('returns false for crypto symbols', () => {
    expect(isOptionSymbol('BTC/USD')).toBe(false);
    expect(isOptionSymbol('BTCUSD')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOptionSymbol('')).toBe(false);
  });

  it('returns false for symbols with 7-char underlying', () => {
    expect(isOptionSymbol('ABCDEFG260320C00150000')).toBe(false);
  });
});

describe('parseOptionSymbol', () => {
  it('parses a valid call symbol', () => {
    const result = parseOptionSymbol('AAPL260320C00230000');
    expect(result).toEqual({
      underlying: 'AAPL',
      expiration: '2026-03-20',
      type: 'call',
      strike: '230.00',
    });
  });

  it('parses a valid put symbol', () => {
    const result = parseOptionSymbol('MSFT260117P00400000');
    expect(result).toEqual({
      underlying: 'MSFT',
      expiration: '2026-01-17',
      type: 'put',
      strike: '400.00',
    });
  });

  it('parses a low strike price', () => {
    const result = parseOptionSymbol('F260320C00015000');
    expect(result).toEqual({
      underlying: 'F',
      expiration: '2026-03-20',
      type: 'call',
      strike: '15.00',
    });
  });

  it('parses a high strike price', () => {
    const result = parseOptionSymbol('SPY261218P00600000');
    expect(result).toEqual({
      underlying: 'SPY',
      expiration: '2026-12-18',
      type: 'put',
      strike: '600.00',
    });
  });

  it('parses fractional strike (e.g. 0.50)', () => {
    const result = parseOptionSymbol('SIRI260320C00000500');
    expect(result).toEqual({
      underlying: 'SIRI',
      expiration: '2026-03-20',
      type: 'call',
      strike: '0.50',
    });
  });

  it('handles lowercase input', () => {
    const result = parseOptionSymbol('aapl260320c00230000');
    expect(result).not.toBeNull();
    expect(result!.underlying).toBe('AAPL');
    expect(result!.type).toBe('call');
  });

  it('returns null for equity symbol', () => {
    expect(parseOptionSymbol('AAPL')).toBeNull();
  });

  it('returns null for crypto symbol', () => {
    expect(parseOptionSymbol('BTC/USD')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseOptionSymbol('')).toBeNull();
  });
});
