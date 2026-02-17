import { ALPACA_DATA_BASE_URL, isCryptoSymbol, normalizeCryptoSymbol, parseOptionSymbol } from '@algoarena/shared';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataProvider } from './market-data.provider';
import {
  AlpacaAsset,
  AlpacaBar,
  AlpacaBarsResponse,
  AlpacaCalendarDay,
  AlpacaClock,
  AlpacaCryptoBarsResponse,
  AlpacaCryptoQuoteResponse,
  AlpacaCryptoSnapshotResponse,
  AlpacaMultiBarsResponse,
  AlpacaMultiQuoteResponse,
  AlpacaOptionContract,
  AlpacaOptionContractsResponse,
  AlpacaOptionSnapshot,
  AlpacaOptionSnapshotsResponse,
  AlpacaQuote,
  AlpacaQuoteResponse,
  AlpacaSnapshot,
} from './types/alpaca.types';
import {
  Asset,
  Bar,
  BarsResponse,
  CalendarDay,
  MarketClock,
  MultiBarsResponse,
  OptionChainResponse,
  OptionContract,
  OptionQuote,
  Quote,
  Snapshot,
} from './types/market-data-provider.types';

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
    if (isCryptoSymbol(symbol)) {
      const normalized = normalizeCryptoSymbol(symbol);
      const res = await this.cryptoDataRequest<AlpacaCryptoQuoteResponse>('/v1beta3/crypto/us/latest/quotes', {
        symbols: normalized,
      });
      const quote = res.quotes[normalized];
      if (!quote) throw new HttpException(`No crypto quote for ${normalized}`, HttpStatus.NOT_FOUND);
      return this.mapQuote(quote);
    }

    const res = await this.dataRequest<AlpacaQuoteResponse>(`/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`);
    return this.mapQuote(res.quote);
  }

  async getLatestQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const { crypto, equity } = this.partitionSymbols(symbols);
    const result: Record<string, Quote> = {};

    const promises: Promise<void>[] = [];

    if (equity.length > 0) {
      promises.push(
        this.dataRequest<AlpacaMultiQuoteResponse>('/v2/stocks/quotes/latest', {
          symbols: equity.join(','),
        }).then((res) => {
          for (const [sym, quote] of Object.entries(res.quotes)) {
            result[sym] = this.mapQuote(quote);
          }
        }),
      );
    }

    if (crypto.length > 0) {
      promises.push(
        this.cryptoDataRequest<AlpacaCryptoQuoteResponse>('/v1beta3/crypto/us/latest/quotes', {
          symbols: crypto.join(','),
        }).then((res) => {
          for (const [sym, quote] of Object.entries(res.quotes)) {
            result[sym] = this.mapQuote(quote);
          }
        }),
      );
    }

    await Promise.all(promises);
    return result;
  }

  async getBars(
    symbol: string,
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<BarsResponse> {
    if (isCryptoSymbol(symbol)) {
      const normalized = normalizeCryptoSymbol(symbol);
      const res = await this.cryptoDataRequest<AlpacaCryptoBarsResponse>('/v1beta3/crypto/us/bars', {
        symbols: normalized,
        ...(params as Record<string, string | number>),
      });
      const bars = res.bars[normalized] || [];
      return {
        bars: bars.map((b) => this.mapBar(b)),
        symbol: normalized,
        nextPageToken: res.next_page_token,
      };
    }

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

  async getMultiBars(
    symbols: string[],
    params: { timeframe: string; start?: string; end?: string; limit?: number },
  ): Promise<MultiBarsResponse> {
    const { crypto, equity } = this.partitionSymbols(symbols);
    const bars: Record<string, Bar[]> = {};
    let nextPageToken: string | null = null;

    const promises: Promise<void>[] = [];

    if (equity.length > 0) {
      promises.push(
        this.dataRequest<AlpacaMultiBarsResponse>('/v2/stocks/bars', {
          symbols: equity.join(','),
          ...(params as Record<string, string | number>),
        }).then((res) => {
          for (const [sym, alpacaBars] of Object.entries(res.bars || {})) {
            bars[sym] = alpacaBars.map((b) => this.mapBar(b));
          }
          if (res.next_page_token) nextPageToken = res.next_page_token;
        }),
      );
    }

    if (crypto.length > 0) {
      promises.push(
        this.cryptoDataRequest<AlpacaCryptoBarsResponse>('/v1beta3/crypto/us/bars', {
          symbols: crypto.join(','),
          ...(params as Record<string, string | number>),
        }).then((res) => {
          for (const [sym, alpacaBars] of Object.entries(res.bars || {})) {
            bars[sym] = alpacaBars.map((b) => this.mapBar(b));
          }
        }),
      );
    }

    await Promise.all(promises);
    return { bars, nextPageToken };
  }

  async getSnapshot(symbol: string): Promise<Snapshot> {
    if (isCryptoSymbol(symbol)) {
      const normalized = normalizeCryptoSymbol(symbol);
      const res = await this.cryptoDataRequest<AlpacaCryptoSnapshotResponse>('/v1beta3/crypto/us/snapshots', {
        symbols: normalized,
      });
      const snap = res.snapshots[normalized];
      if (!snap) throw new HttpException(`No crypto snapshot for ${normalized}`, HttpStatus.NOT_FOUND);
      return {
        latestTrade: {
          timestamp: snap.latestTrade.t,
          price: snap.latestTrade.p,
          size: snap.latestTrade.s,
        },
        latestQuote: this.mapQuote(snap.latestQuote),
        minuteBar: this.mapBar(snap.minuteBar),
        dailyBar: this.mapBar(snap.dailyBar),
        prevDailyBar: this.mapBar(snap.prevDailyBar),
      };
    }

    const res = await this.dataRequest<AlpacaSnapshot>(`/v2/stocks/${encodeURIComponent(symbol)}/snapshot`);
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

  async getAssets(params?: { status?: string; asset_class?: string }): Promise<Asset[]> {
    const res = await this.tradingRequest<AlpacaAsset[]>('/v2/assets', params);
    return res.map((a) => this.mapAsset(a));
  }

  async getAsset(symbol: string): Promise<Asset> {
    const normalized = isCryptoSymbol(symbol) ? normalizeCryptoSymbol(symbol) : symbol;
    const res = await this.tradingRequest<AlpacaAsset>(`/v2/assets/${encodeURIComponent(normalized)}`);
    return this.mapAsset(res);
  }

  async getCalendar(params?: { start?: string; end?: string }): Promise<CalendarDay[]> {
    const res = await this.tradingRequest<AlpacaCalendarDay[]>('/v2/calendar', params);
    return res.map((d) => ({
      date: d.date,
      open: d.open,
      close: d.close,
      sessionOpen: d.session_open,
      sessionClose: d.session_close,
    }));
  }

  // ── Options ──

  async getOptionChain(
    underlying: string,
    params?: { expiration?: string; type?: string; strike_price_gte?: string; strike_price_lte?: string },
  ): Promise<OptionChainResponse> {
    const upper = underlying.toUpperCase();

    // Fetch contracts from trading API with pagination
    const allContracts: AlpacaOptionContract[] = [];
    let pageToken: string | null = null;

    do {
      const queryParams: Record<string, string | number | undefined> = {
        underlying_symbols: upper,
        status: 'active',
        limit: 100,
        ...(params?.expiration ? { expiration_date: params.expiration } : {}),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.strike_price_gte ? { strike_price_gte: params.strike_price_gte } : {}),
        ...(params?.strike_price_lte ? { strike_price_lte: params.strike_price_lte } : {}),
        ...(pageToken ? { page_token: pageToken } : {}),
      };

      const res = await this.tradingRequest<AlpacaOptionContractsResponse>('/v2/options/contracts', queryParams);
      allContracts.push(...(res.option_contracts || []));
      pageToken = res.next_page_token;
    } while (pageToken);

    if (allContracts.length === 0) {
      return { underlying: upper, expirations: [], contracts: [] };
    }

    // Batch-fetch snapshots for greeks/quotes (max 100 symbols per request)
    const snapshotMap: Record<string, AlpacaOptionSnapshot> = {};
    const contractSymbols = allContracts.map((c) => c.symbol);

    for (let i = 0; i < contractSymbols.length; i += 100) {
      const batch = contractSymbols.slice(i, i + 100);
      try {
        const snapRes = await this.optionsDataRequest<AlpacaOptionSnapshotsResponse>('/v1beta1/options/snapshots', {
          symbols: batch.join(','),
        });
        for (const [sym, snap] of Object.entries(snapRes.snapshots || {})) {
          snapshotMap[sym] = snap;
        }
      } catch {
        this.logger.warn(`Failed to fetch option snapshots for batch starting at index ${i}`);
      }
    }

    // Build canonical contracts
    const contracts: OptionContract[] = allContracts.map((c) => {
      const snap = snapshotMap[c.symbol];
      return {
        symbol: c.symbol,
        underlying: c.underlying_symbol,
        type: c.type,
        strike: c.strike_price,
        expiration: c.expiration_date,
        status: c.status,
        tradable: c.tradable,
        multiplier: parseInt(c.multiplier, 10) || 100,
        style: c.style,
        openInterest: parseInt(c.open_interest, 10) || 0,
        greeks: snap?.greeks ?? null,
        quote: snap
          ? {
              bid: String(snap.latestQuote?.bp ?? 0),
              ask: String(snap.latestQuote?.ap ?? 0),
              last: String(snap.latestTrade?.p ?? 0),
              volume: snap.latestTrade?.s ?? 0,
              impliedVolatility: snap.impliedVolatility,
            }
          : null,
      };
    });

    const expirations = [...new Set(contracts.map((c) => c.expiration))].sort();

    return { underlying: upper, expirations, contracts };
  }

  async getOptionQuotes(symbols: string[]): Promise<Record<string, OptionQuote>> {
    if (symbols.length === 0) return {};

    const result: Record<string, OptionQuote> = {};

    // Fetch option snapshots in batches of 100
    const allSnapshots: Record<string, AlpacaOptionSnapshot> = {};
    for (let i = 0; i < symbols.length; i += 100) {
      const batch = symbols.slice(i, i + 100);
      const res = await this.optionsDataRequest<AlpacaOptionSnapshotsResponse>('/v1beta1/options/snapshots', {
        symbols: batch.join(','),
      });
      for (const [sym, snap] of Object.entries(res.snapshots || {})) {
        allSnapshots[sym] = snap;
      }
    }

    // Fetch underlying equity quotes for price context
    const underlyings = new Set<string>();
    for (const sym of symbols) {
      const parsed = parseOptionSymbol(sym);
      if (parsed) underlyings.add(parsed.underlying);
    }
    const underlyingQuotes: Record<string, Quote> = {};
    if (underlyings.size > 0) {
      try {
        const uQuotes = await this.getLatestQuotes([...underlyings]);
        for (const [sym, q] of Object.entries(uQuotes)) {
          underlyingQuotes[sym] = q;
        }
      } catch {
        this.logger.warn('Failed to fetch underlying quotes for option quotes');
      }
    }

    for (const sym of symbols) {
      const snap = allSnapshots[sym];
      if (!snap) continue;

      const parsed = parseOptionSymbol(sym);
      const underlyingSymbol = parsed?.underlying ?? '';
      const underlyingQuote = underlyingQuotes[underlyingSymbol];

      result[sym] = {
        symbol: sym,
        bid: String(snap.latestQuote?.bp ?? 0),
        ask: String(snap.latestQuote?.ap ?? 0),
        last: String(snap.latestTrade?.p ?? 0),
        volume: snap.latestTrade?.s ?? 0,
        openInterest: 0,
        impliedVolatility: snap.impliedVolatility,
        greeks: snap.greeks,
        underlying: {
          symbol: underlyingSymbol,
          price: underlyingQuote ? String(underlyingQuote.bidPrice) : '0',
        },
      };
    }

    return result;
  }

  async getOptionExpirations(underlying: string): Promise<string[]> {
    const upper = underlying.toUpperCase();

    const allExpirations = new Set<string>();
    let pageToken: string | null = null;

    do {
      const queryParams: Record<string, string | number | undefined> = {
        underlying_symbols: upper,
        status: 'active',
        limit: 100,
        ...(pageToken ? { page_token: pageToken } : {}),
      };

      const res = await this.tradingRequest<AlpacaOptionContractsResponse>('/v2/options/contracts', queryParams);
      for (const c of res.option_contracts || []) {
        allExpirations.add(c.expiration_date);
      }
      pageToken = res.next_page_token;
    } while (pageToken);

    return [...allExpirations].sort();
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
      minOrderSize: a.min_order_size,
      minTradeIncrement: a.min_trade_increment,
      priceIncrement: a.price_increment,
    };
  }

  // ── Private Helpers ──

  private partitionSymbols(symbols: string[]): { crypto: string[]; equity: string[] } {
    const crypto: string[] = [];
    const equity: string[] = [];
    for (const s of symbols) {
      if (isCryptoSymbol(s)) {
        crypto.push(normalizeCryptoSymbol(s));
      } else {
        equity.push(s);
      }
    }
    return { crypto, equity };
  }

  // ── Private HTTP Helpers ──

  private async optionsDataRequest<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>(ALPACA_DATA_BASE_URL, path, params);
  }

  private async cryptoDataRequest<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>(ALPACA_DATA_BASE_URL, path, params);
  }

  private async dataRequest<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>(ALPACA_DATA_BASE_URL, path, { ...params, feed: 'sip' });
  }

  private async tradingRequest<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
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
        response.status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST,
      );
    }

    return response.json() as Promise<T>;
  }
}
