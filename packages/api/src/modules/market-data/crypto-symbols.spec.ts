import { isCryptoSymbol, normalizeCryptoSymbol } from '@algoarena/shared';

describe('crypto symbol utilities', () => {
  // ── isCryptoSymbol ──

  describe('isCryptoSymbol', () => {
    it('slash notation → true', () => {
      expect(isCryptoSymbol('BTC/USD')).toBe(true);
    });

    it('slash notation lowercase → true', () => {
      expect(isCryptoSymbol('btc/usd')).toBe(true);
    });

    it('compact notation with known base → true', () => {
      expect(isCryptoSymbol('BTCUSD')).toBe(true);
    });

    it('compact notation lowercase → true', () => {
      expect(isCryptoSymbol('ethusd')).toBe(true);
    });

    it('various known bases in compact form', () => {
      for (const base of ['SOL', 'XRP', 'ADA', 'DOGE', 'SHIB', 'LTC', 'AVAX', 'LINK']) {
        expect(isCryptoSymbol(`${base}USD`)).toBe(true);
      }
    });

    it('various known bases in slash form', () => {
      for (const base of ['SOL', 'XRP', 'ADA', 'DOGE', 'SHIB', 'LTC', 'AVAX', 'LINK']) {
        expect(isCryptoSymbol(`${base}/USD`)).toBe(true);
      }
    });

    it('equity symbol → false', () => {
      expect(isCryptoSymbol('AAPL')).toBe(false);
    });

    it('equity symbol that starts with known base → false (ADAB is not ADAUSD)', () => {
      expect(isCryptoSymbol('ADAB')).toBe(false);
    });

    it('unknown compact crypto (not in known bases) → false', () => {
      expect(isCryptoSymbol('XYZUSD')).toBe(false);
    });

    it('unknown slash notation → true (any slash is crypto)', () => {
      expect(isCryptoSymbol('XYZ/USD')).toBe(true);
    });

    it('ALGO (equity ticker) without USD → false', () => {
      expect(isCryptoSymbol('ALGO')).toBe(false);
    });

    it('ALGOUSD → true (known base)', () => {
      expect(isCryptoSymbol('ALGOUSD')).toBe(true);
    });
  });

  // ── normalizeCryptoSymbol ──

  describe('normalizeCryptoSymbol', () => {
    it('compact BTCUSD → BTC/USD', () => {
      expect(normalizeCryptoSymbol('BTCUSD')).toBe('BTC/USD');
    });

    it('compact lowercase ethusd → ETH/USD', () => {
      expect(normalizeCryptoSymbol('ethusd')).toBe('ETH/USD');
    });

    it('slash notation passes through unchanged', () => {
      expect(normalizeCryptoSymbol('BTC/USD')).toBe('BTC/USD');
    });

    it('slash notation lowercase → uppercased', () => {
      expect(normalizeCryptoSymbol('btc/usd')).toBe('BTC/USD');
    });

    it('non-crypto symbol → uppercased as-is', () => {
      expect(normalizeCryptoSymbol('aapl')).toBe('AAPL');
    });

    it('unknown compact (not known base) → uppercased as-is', () => {
      expect(normalizeCryptoSymbol('XYZUSD')).toBe('XYZUSD');
    });

    it('all known bases normalize correctly', () => {
      const bases = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'AVAX', 'LINK', 'DOGE', 'SHIB', 'LTC', 'BCH', 'MATIC'];
      for (const base of bases) {
        expect(normalizeCryptoSymbol(`${base}USD`)).toBe(`${base}/USD`);
        expect(normalizeCryptoSymbol(`${base}/USD`)).toBe(`${base}/USD`);
      }
    });
  });
});
