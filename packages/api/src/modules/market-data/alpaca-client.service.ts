import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALPACA_DATA_BASE_URL } from '@algoarena/shared';
import { MarketDataProvider } from './market-data.provider';
import type {
  Quote,
  BarsResponse,
  Bar,
  Snapshot,
  MarketClock,
  Asset,
  CalendarDay,
} from './types/market-data-provider.types';
import type {
  AlpacaQuote,
  AlpacaQuoteResponse,
  AlpacaMultiQuoteResponse,
  AlpacaBar,
  AlpacaBarsResponse,
  AlpacaSnapshot,
  AlpacaClock,
  AlpacaAsset,
  AlpacaCalendarDay,
} from './types/alpaca.types';

@Injectable()
export class AlpacaClientService extends MarketDataProvider {
  private readonly logger = new Logger(AlpacaClientService.name);
  private readonly tradingBaseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    super();
    const alpacaApiUrl = this.configService.getOrThrow<string>('ALPACA_API_URL');
    this.tradingBaseUrl = alpacaApiUrl.replace(/\/v2\/?$/, '');

    this.headers = {
      'APCA-API-KEY-ID': this.configService.getOrThrow<string>('ALPACA_API_KEY'),
      'APCA-API-SECRET-KEY': this.configService.getOrThrow<string>('ALPACA_API_SECRET'),
    };
  }

  // ── MarketDataProvider Implementation ──

  async getLatestQuote(symbol: string): Promise<Quote> {
    const res = await this.dataRequest<AlpacaQuoteResponse>(
      `/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`,
    );
    return this.mapQuote(res.quote);
  }

  async getLatestQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const res = await this.dataRequest<AlpacaMultiQuoteResponse>(
      '/v2/stocks/quotes/latest',
      { symbols: symbols.join(',') },
    );
    const result: Record<string, Quote> = {};
    for (const [sym, quote] of Object.entries(res.quotes)) {
      result[sym] = this.mapQuote(quote);
    }
    return result;
  }

  async getBars(
    symbol: string,
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<BarsResponse> {
    const res = await this.dataRequest<AlpacaBarsResponse>(
      `/v2/stocks/${encodeURIComponent(symbol)}/bars`,
      params as Record<string, string | number>,
    );
    return {
      bars: (res.bars || []).map((b) => this.mapBar(b)),
      symbol: res.symbol,
      nextPageToken: res.next_page_token,
    };
  }

  async getSnapshot(symbol: string): Promise<Snapshot> {
    const res = await this.dataRequest<AlpacaSnapshot>(
      `/v2/stocks/${encodeURIComponent(symbol)}/snapshot`,
    );
    return {
      latestTrade: {
        timestamp: res.latestTrade.t,
        price: res.latestTrade.p,
        size: res.latestTrade.s,
      },
      latestQuote: this.mapQuote(res.latestQuote),
      minuteBar: this.mapBar(res.minuteBar),
      dailyBar: this.mapBar(res.dailyBar),
      prevDailyBar: this.mapBar(res.prevDailyBar),
    };
  }

  async getClock(): Promise<MarketClock> {
    const res = await this.tradingRequest<AlpacaClock>('/v2/clock');
    return {
      timestamp: res.timestamp,
      isOpen: res.is_open,
      nextOpen: res.next_open,
      nextClose: res.next_close,
    };
  }

  async getAssets(params?: {
    status?: string;
    asset_class?: string;
  }): Promise<Asset[]> {
    const res = await this.tradingRequest<AlpacaAsset[]>('/v2/assets', params);
    return res.map((a) => this.mapAsset(a));
  }

  async getAsset(symbol: string): Promise<Asset> {
    const res = await this.tradingRequest<AlpacaAsset>(
      `/v2/assets/${encodeURIComponent(symbol)}`,
    );
    return this.mapAsset(res);
  }

  async getCalendar(params?: {
    start?: string;
    end?: string;
  }): Promise<CalendarDay[]> {
    const res = await this.tradingRequest<AlpacaCalendarDay[]>('/v2/calendar', params);
    return res.map((d) => ({
      date: d.date,
      open: d.open,
      close: d.close,
      sessionOpen: d.session_open,
      sessionClose: d.session_close,
    }));
  }

  // ── Alpaca → Canonical Mappers ──

  private mapQuote(q: AlpacaQuote): Quote {
    return {
      timestamp: q.t,
      askPrice: q.ap,
      askSize: q.as,
      bidPrice: q.bp,
      bidSize: q.bs,
    };
  }

  private mapBar(b: AlpacaBar): Bar {
    return {
      timestamp: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      tradeCount: b.n,
      vwap: b.vw,
    };
  }

  private mapAsset(a: AlpacaAsset): Asset {
    return {
      id: a.id,
      class: a.class,
      exchange: a.exchange,
      symbol: a.symbol,
      name: a.name,
      status: a.status,
      tradable: a.tradable,
      marginable: a.marginable,
      shortable: a.shortable,
      easyToBorrow: a.easy_to_borrow,
      fractionable: a.fractionable,
      maintenanceMarginRequirement: a.maintenance_margin_requirement,
    };
  }

  // ── Private HTTP Helpers ──

  private async dataRequest<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>(ALPACA_DATA_BASE_URL, path, { ...params, feed: 'sip' });
  }

  private async tradingRequest<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>(this.tradingBaseUrl, path, params);
  }

  private async request<T>(
    baseUrl: string,
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(path, baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    this.logger.debug(`Alpaca request: ${url.toString()}`);

    const response = await fetch(url.toString(), { headers: this.headers });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Alpaca API error ${response.status}: ${body}`);
      throw new HttpException(
        `Alpaca API error: ${response.statusText}`,
        response.status >= 500
          ? HttpStatus.BAD_GATEWAY
          : HttpStatus.BAD_REQUEST,
      );
    }

    return response.json() as Promise<T>;
  }
}
