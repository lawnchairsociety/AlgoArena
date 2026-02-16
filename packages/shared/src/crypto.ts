// ── Known crypto base currencies ──

export const KNOWN_CRYPTO_BASES = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'ADA',
  'DOT',
  'AVAX',
  'LINK',
  'AAVE',
  'UNI',
  'MKR',
  'CRV',
  'SUSHI',
  'DOGE',
  'SHIB',
  'USDT',
  'USDC',
  'LTC',
  'BCH',
  'MATIC',
  'ALGO',
  'ATOM',
  'FIL',
  'NEAR',
  'APE',
  'GRT',
  'BAT',
  'MANA',
] as const;

/**
 * Returns true if symbol is crypto (slash notation `BTC/USD` or compact `BTCUSD` with known base).
 */
export function isCryptoSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (upper.includes('/')) return true;
  for (const base of KNOWN_CRYPTO_BASES) {
    if (upper === `${base}USD`) return true;
  }
  return false;
}

/**
 * Normalizes crypto symbols to slash notation (`BTCUSD` → `BTC/USD`).
 * Non-crypto symbols are returned uppercased as-is.
 */
export function normalizeCryptoSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes('/')) return upper;
  for (const base of KNOWN_CRYPTO_BASES) {
    if (upper === `${base}USD`) return `${base}/USD`;
  }
  return upper;
}
