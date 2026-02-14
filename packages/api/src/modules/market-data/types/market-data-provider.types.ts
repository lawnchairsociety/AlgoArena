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
}

export interface CalendarDay {
  date: string;
  open: string;
  close: string;
  sessionOpen: string;
  sessionClose: string;
}
