import {
  Asset,
  BarsResponse,
  CalendarDay,
  MarketClock,
  MultiBarsResponse,
  Quote,
  Snapshot,
} from './types/market-data-provider.types';

/**
 * Abstract market data provider.
 *
 * Implement this class to add a new data source (Alpaca, Polygon, Finnhub, etc.).
 * Register your implementation in MarketDataModule and set MARKET_DATA_PROVIDER
 * in .env to your provider's key.
 *
 * See AlpacaClientService for a reference implementation.
 */
export abstract class MarketDataProvider {
  /** Get the latest quote for a single symbol. */
  abstract getLatestQuote(symbol: string): Promise<Quote>;

  /** Get the latest quotes for multiple symbols. */
  abstract getLatestQuotes(symbols: string[]): Promise<Record<string, Quote>>;

  /** Get historical bars for a symbol. */
  abstract getBars(
    symbol: string,
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<BarsResponse>;

  /** Get historical bars for multiple symbols. */
  abstract getMultiBars(
    symbols: string[],
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<MultiBarsResponse>;

  /** Get a market snapshot for a symbol. */
  abstract getSnapshot(symbol: string): Promise<Snapshot>;

  /** Get the current market clock (open/close status). */
  abstract getClock(): Promise<MarketClock>;

  /** List tradeable assets, optionally filtered. */
  abstract getAssets(params?: { status?: string; asset_class?: string }): Promise<Asset[]>;

  /** Get a single asset by symbol. */
  abstract getAsset(symbol: string): Promise<Asset>;

  /** Get the market calendar. */
  abstract getCalendar(params?: { start?: string; end?: string }): Promise<CalendarDay[]>;
}
