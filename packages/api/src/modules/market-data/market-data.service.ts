import {
  CACHE_TTL_ASSETS,
  CACHE_TTL_BARS,
  CACHE_TTL_CALENDAR,
  CACHE_TTL_CLOCK,
  CACHE_TTL_QUOTES,
  CACHE_TTL_SNAPSHOTS,
} from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import { ValkeyProvider } from '../cache/valkey.provider';
import { MarketDataProvider } from './market-data.provider';
import { Asset, BarsResponse, CalendarDay, MarketClock, Quote, Snapshot } from './types/market-data-provider.types';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly cache: ValkeyProvider,
    private readonly provider: MarketDataProvider,
  ) {}

  // ── Quotes ──

  async getQuote(symbol: string): Promise<Quote> {
    const key = `quote:${symbol.toUpperCase()}`;
    const cached = await this.cache.get<Quote>(key);
    if (cached) return cached;

    const quote = await this.provider.getLatestQuote(symbol);
    await this.cache.set(key, quote, CACHE_TTL_QUOTES);
    return quote;
  }

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const upper = symbols.map((s) => s.toUpperCase());
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
    const sym = symbol.toUpperCase();
    const key = `bars:${sym}:${params.timeframe}:${params.start ?? ''}:${params.end ?? ''}:${params.limit ?? ''}`;

    const cached = await this.cache.get<BarsResponse>(key);
    if (cached) return cached;

    const bars = await this.provider.getBars(sym, params);
    await this.cache.set(key, bars, CACHE_TTL_BARS);
    return bars;
  }

  // ── Snapshots ──

  async getSnapshot(symbol: string): Promise<Snapshot> {
    const key = `snapshot:${symbol.toUpperCase()}`;
    const cached = await this.cache.get<Snapshot>(key);
    if (cached) return cached;

    const snapshot = await this.provider.getSnapshot(symbol);
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
}
