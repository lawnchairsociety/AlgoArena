// ── OCC option symbol utilities ──

const OCC_REGEX = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

/**
 * Returns true if symbol matches OCC option format (e.g. AAPL260320C00230000).
 */
export function isOptionSymbol(symbol: string): boolean {
  return OCC_REGEX.test(symbol.toUpperCase());
}

/**
 * Parses an OCC option symbol into its components.
 * Returns null if the symbol is not a valid OCC format.
 */
export function parseOptionSymbol(symbol: string): {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  type: 'call' | 'put';
  strike: string; // decimal string e.g. "230.00"
} | null {
  const match = symbol.toUpperCase().match(OCC_REGEX);
  if (!match) return null;
  const [, underlying, dateStr, cp, strikeStr] = match;
  const yy = dateStr.slice(0, 2);
  const mm = dateStr.slice(2, 4);
  const dd = dateStr.slice(4, 6);
  const expiration = `20${yy}-${mm}-${dd}`;
  const type = cp === 'C' ? 'call' : 'put';
  const strikeRaw = parseInt(strikeStr, 10);
  const strike = (strikeRaw / 1000).toFixed(2);
  return { underlying, expiration, type, strike };
}
