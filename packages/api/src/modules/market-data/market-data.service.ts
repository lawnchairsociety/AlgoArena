import {
  CACHE_TTL_ASSETS,
  CACHE_TTL_BARS,
  CACHE_TTL_CALENDAR,
  CACHE_TTL_CLOCK,
  CACHE_TTL_OPTION_CHAIN,
  CACHE_TTL_OPTION_QUOTES,
  CACHE_TTL_QUOTES,
  CACHE_TTL_SNAPSHOTS,
  isCryptoSymbol,
  normalizeCryptoSymbol,
} from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import { ValkeyProvider } from '../cache/valkey.provider';
import { MarketDataProvider } from './market-data.provider';
import {
  Asset,
  BarsResponse,
  CalendarDay,
  MarketClock,
  MultiBarsResponse,
  OptionChainResponse,
  OptionQuote,
  Quote,
  Snapshot,
} from './types/market-data-provider.types';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly cache: ValkeyProvider,
    private readonly provider: MarketDataProvider,
  ) {}

  // ── Quotes ──

  async getQuote(symbol: string): Promise<Quote> {
    const sym = this.normalizeSymbol(symbol);
    const key = `quote:${sym}`;
    const cached = await this.cache.get<Quote>(key);
    if (cached) return cached;

    const quote = await this.provider.getLatestQuote(sym);
    await this.cache.set(key, quote, CACHE_TTL_QUOTES);
    return quote;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const upper = symbols.map((s) => this.normalizeSymbol(s));
    const result: Record<string, Quote> = {};
    const uncached: string[] = [];

    for (const sym of upper) {
      const cached = await this.cache.get<Quote>(`quote:${sym}`);
      if (cached) {
        result[sym] = cached;
      } else {
        uncached.push(sym);
      }
    }

    if (uncached.length > 0) {
      const fresh = await this.provider.getLatestQuotes(uncached);
      for (const [sym, quote] of Object.entries(fresh)) {
        result[sym] = quote;
        await this.cache.set(`quote:${sym}`, quote, CACHE_TTL_QUOTES);
      }
    }

    return result;
  }

  // ── Bars ──

  async getBars(
    symbol: string,
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<BarsResponse> {
    const sym = this.normalizeSymbol(symbol);
    const key = `bars:${sym}:${params.timeframe}:${params.start ?? ''}:${params.end ?? ''}:${params.limit ?? ''}`;

    const cached = await this.cache.get<BarsResponse>(key);
    if (cached) return cached;

    const bars = await this.provider.getBars(sym, params);
    await this.cache.set(key, bars, CACHE_TTL_BARS);
    return bars;
  }

  async getMultiBars(
    symbols: string[],
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<MultiBarsResponse> {
    const upper = symbols.map((s) => this.normalizeSymbol(s));
    const result: Record<string, BarsResponse> = {};
    const uncached: string[] = [];

    for (const sym of upper) {
      const key = `bars:${sym}:${params.timeframe}:${params.start ?? ''}:${params.end ?? ''}:${params.limit ?? ''}`;
      const cached = await this.cache.get<BarsResponse>(key);
      if (cached) {
        result[sym] = cached;
      } else {
        uncached.push(sym);
      }
    }

    if (uncached.length > 0) {
      const fresh = await this.provider.getMultiBars(uncached, params);
      for (const [sym, bars] of Object.entries(fresh.bars)) {
        const barsResponse: BarsResponse = { bars, symbol: sym, nextPageToken: fresh.nextPageToken };
        result[sym] = barsResponse;
        const key = `bars:${sym}:${params.timeframe}:${params.start ?? ''}:${params.end ?? ''}:${params.limit ?? ''}`;
        await this.cache.set(key, barsResponse, CACHE_TTL_BARS);
      }
    }

    const bars: Record<string, BarsResponse['bars']> = {};
    for (const [sym, barsResponse] of Object.entries(result)) {
      bars[sym] = barsResponse.bars;
    }

    return { bars, nextPageToken: null };
  }

  // ── Snapshots ──

  async getSnapshot(symbol: string): Promise<Snapshot> {
    const sym = this.normalizeSymbol(symbol);
    const key = `snapshot:${sym}`;
    const cached = await this.cache.get<Snapshot>(key);
    if (cached) return cached;

    const snapshot = await this.provider.getSnapshot(sym);
    await this.cache.set(key, snapshot, CACHE_TTL_SNAPSHOTS);
    return snapshot;
  }

  // ── Clock ──

  async getClock(): Promise<MarketClock> {
    const key = 'market:clock';
    const cached = await this.cache.get<MarketClock>(key);
    if (cached) return cached;

    const clock = await this.provider.getClock();
    await this.cache.set(key, clock, CACHE_TTL_CLOCK);
    return clock;
  }

  // ── Assets ──

  async getAssets(params?: { status?: string; asset_class?: string }): Promise<Asset[]> {
    const isFiltered = params?.status || params?.asset_class;

    if (!isFiltered) {
      const cached = await this.cache.get<Asset[]>('market:assets');
      if (cached) return cached;
    }

    const assets = await this.provider.getAssets(params);

    if (!isFiltered) {
      await this.cache.set('market:assets', assets, CACHE_TTL_ASSETS);
    }

    return assets;
  }

  // ── Calendar ──

  async getCalendar(params?: { start?: string; end?: string }): Promise<CalendarDay[]> {
    const key = `market:calendar:${params?.start ?? ''}:${params?.end ?? ''}`;
    const cached = await this.cache.get<CalendarDay[]>(key);
    if (cached) return cached;

    const calendar = await this.provider.getCalendar(params);
    await this.cache.set(key, calendar, CACHE_TTL_CALENDAR);
    return calendar;
  }

  // ── Options ──

  async getOptionChain(
    underlying: string,
    params?: { expiration?: string; type?: string; strike_price_gte?: string; strike_price_lte?: string },
  ): Promise<OptionChainResponse> {
    const key = `options:chain:${underlying.toUpperCase()}:${JSON.stringify(params ?? {})}`;
    const cached = await this.cache.get<OptionChainResponse>(key);
    if (cached) return cached;

    const chain = await this.provider.getOptionChain(underlying, params);
    await this.cache.set(key, chain, CACHE_TTL_OPTION_CHAIN);
    return chain;
  }

  async getOptionQuotes(symbols: string[]): Promise<Record<string, OptionQuote>> {
    const result: Record<string, OptionQuote> = {};
    const uncached: string[] = [];

    for (const sym of symbols) {
      const cached = await this.cache.get<OptionQuote>(`options:quote:${sym}`);
      if (cached) {
        result[sym] = cached;
      } else {
        uncached.push(sym);
      }
    }

    if (uncached.length > 0) {
      const fresh = await this.provider.getOptionQuotes(uncached);
      for (const [sym, quote] of Object.entries(fresh)) {
        result[sym] = quote;
        await this.cache.set(`options:quote:${sym}`, quote, CACHE_TTL_OPTION_QUOTES);
      }
    }

    return result;
  }

  async getOptionExpirations(underlying: string): Promise<string[]> {
    const key = `options:expirations:${underlying.toUpperCase()}`;
    const cached = await this.cache.get<string[]>(key);
    if (cached) return cached;

    const expirations = await this.provider.getOptionExpirations(underlying);
    await this.cache.set(key, expirations, CACHE_TTL_OPTION_CHAIN);
    return expirations;
  }

  // ── Private Helpers ──

  private normalizeSymbol(symbol: string): string {
    return isCryptoSymbol(symbol) ? normalizeCryptoSymbol(symbol) : symbol.toUpperCase();
  }
}
