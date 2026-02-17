// ── Quote ──

export interface AlpacaQuote {
  t: string; // timestamp
  ax: string; // ask exchange
  ap: number; // ask price
  as: number; // ask size
  bx: string; // bid exchange
  bp: number; // bid price
  bs: number; // bid size
  c: string[]; // conditions
  z: string; // tape
}

export interface AlpacaQuoteResponse {
  quote: AlpacaQuote;
}

export interface AlpacaMultiQuoteResponse {
  quotes: Record<string, AlpacaQuote>;
}

// ── Bar ──

export interface AlpacaBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n: number; // number of trades
  vw: number; // volume-weighted avg price
}

export interface AlpacaBarsResponse {
  bars: AlpacaBar[];
  symbol: string;
  next_page_token: string | null;
}

export interface AlpacaMultiBarsResponse {
  bars: Record<string, AlpacaBar[]>;
  next_page_token: string | null;
}

// ── Trade ──

export interface AlpacaTrade {
  t: string; // timestamp
  x: string; // exchange
  p: number; // price
  s: number; // size
  c: string[]; // conditions
  i: number; // trade ID
  z: string; // tape
}

// ── Snapshot ──

export interface AlpacaSnapshot {
  latestTrade: AlpacaTrade;
  latestQuote: AlpacaQuote;
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
}

// ── Clock ──

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

// ── Asset ──

export interface AlpacaAsset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
  maintenance_margin_requirement?: number;
  attributes?: string[];
  min_order_size?: string;
  min_trade_increment?: string;
  price_increment?: string;
}

// ── Crypto Responses ──

export interface AlpacaCryptoQuoteResponse {
  quotes: Record<string, AlpacaQuote>;
}

export interface AlpacaCryptoBarsResponse {
  bars: Record<string, AlpacaBar[]>;
  next_page_token: string | null;
}

export interface AlpacaCryptoSnapshotResponse {
  snapshots: Record<string, AlpacaSnapshot>;
}

// ── Options ──

export interface AlpacaOptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expiration_date: string;
  root_symbol: string;
  underlying_symbol: string;
  underlying_asset_id: string;
  type: 'call' | 'put';
  style: string;
  strike_price: string;
  multiplier: string;
  size: string;
  open_interest: string;
  open_interest_date: string;
  close_price: string;
  close_price_date: string;
}

export interface AlpacaOptionContractsResponse {
  option_contracts: AlpacaOptionContract[];
  next_page_token: string | null;
}

export interface AlpacaOptionSnapshot {
  latestQuote: {
    t: string;
    ax: string;
    ap: number;
    as: number;
    bx: string;
    bp: number;
    bs: number;
    c: string;
  };
  latestTrade: {
    t: string;
    x: string;
    p: number;
    s: number;
    c: string;
  };
  impliedVolatility: number | null;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  } | null;
}

export interface AlpacaOptionSnapshotsResponse {
  snapshots: Record<string, AlpacaOptionSnapshot>;
}

// ── Calendar ──

export interface AlpacaCalendarDay {
  date: string;
  open: string;
  close: string;
  session_open: string;
  session_close: string;
}
