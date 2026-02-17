// ── Provider-agnostic market data types ──
// These are the canonical shapes used throughout the app.
// Provider implementations (Alpaca, Polygon, etc.) must map their
// API responses to these interfaces.

export interface Quote {
  timestamp: string;
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
}

export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
  vwap: number;
}

export interface BarsResponse {
  bars: Bar[];
  symbol: string;
  nextPageToken: string | null;
}

export interface MultiBarsResponse {
  bars: Record<string, Bar[]>;
  nextPageToken: string | null;
}

export interface Trade {
  timestamp: string;
  price: number;
  size: number;
}

export interface Snapshot {
  latestTrade: Trade;
  latestQuote: Quote;
  minuteBar: Bar;
  dailyBar: Bar;
  prevDailyBar: Bar;
}

export interface MarketClock {
  timestamp: string;
  isOpen: boolean;
  nextOpen: string;
  nextClose: string;
}

export interface Asset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easyToBorrow: boolean;
  fractionable: boolean;
  maintenanceMarginRequirement?: number;
  minOrderSize?: string;
  minTradeIncrement?: string;
  priceIncrement?: string;
}

export interface CalendarDay {
  date: string;
  open: string;
  close: string;
  sessionOpen: string;
  sessionClose: string;
}

// ── Options ──

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionContract {
  symbol: string;
  underlying: string;
  type: 'call' | 'put';
  strike: string;
  expiration: string;
  status: string;
  tradable: boolean;
  multiplier: number;
  style: string;
  openInterest: number;
  greeks: OptionGreeks | null;
  quote: {
    bid: string;
    ask: string;
    last: string;
    volume: number;
    impliedVolatility: number | null;
  } | null;
}

export interface OptionChainResponse {
  underlying: string;
  expirations: string[];
  contracts: OptionContract[];
}

export interface OptionQuote {
  symbol: string;
  bid: string;
  ask: string;
  last: string;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  greeks: OptionGreeks | null;
  underlying: {
    symbol: string;
    price: string;
  };
}
