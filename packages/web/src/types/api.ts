export interface CuidUser {
  id: string;
  apiKeyId: string;
  label: string | null;
  startingBalance: string;
  cashBalance: string;
  marginUsed: string;
  pdtEnforced: boolean;
  createdAt: string;
}

export interface AccountSummary {
  userId: string;
  cashBalance: string;
  marginUsed: string;
  positionsValue: string;
  totalEquity: string;
  unrealizedPnl: string;
  totalPnl: string;
  startingBalance: string;
  dayTradeCount: number;
  pdtEnforced: boolean;
  pdtRestricted: boolean;
}

export interface Position {
  id: string;
  cuidUserId: string;
  symbol: string;
  assetClass?: string;
  quantity: string;
  avgCostBasis: string;
  totalCostBasis: string;
  // Option metadata (only set for option positions)
  optionType?: string | null;
  strikePrice?: string | null;
  expiration?: string | null;
  underlyingSymbol?: string | null;
  multiplier?: string | null;
  updatedAt: string;
  side: 'long' | 'short';
  currentPrice: string;
  marketValue: string;
  unrealizedPnl: string;
}

export interface Fill {
  id: string;
  orderId: string;
  cuidUserId: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  totalCost: string;
  filledAt: string;
}

export interface Order {
  id: string;
  cuidUserId: string;
  symbol: string;
  assetClass?: string;
  orderClass?: string | null;
  legGroupId?: string | null;
  side: string;
  type: string;
  timeInForce: string;
  quantity: string;
  filledQuantity: string;
  limitPrice: string | null;
  stopPrice: string | null;
  avgFillPrice: string | null;
  trailPercent: string | null;
  trailPrice: string | null;
  highWaterMark: string | null;
  trailingStopPrice: string | null;
  parentOrderId: string | null;
  bracketGroupId: string | null;
  bracketRole: string | null;
  linkedOrderId: string | null;
  takeProfitLimitPrice: string | null;
  stopLossStopPrice: string | null;
  stopLossLimitPrice: string | null;
  bracket?: {
    takeProfitOrderId?: string;
    stopLossOrderId?: string;
  };
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  filledAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  fills?: Fill[];
}

export interface PortfolioSnapshot {
  id: string;
  cuidUserId: string;
  snapshotDate: string;
  cashBalance: string;
  positionsValue: string;
  totalEquity: string;
  dayPnl: string;
  totalPnl: string;
  createdAt: string;
}

export interface TradeHistory {
  id: string;
  cuidUserId: string;
  symbol: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: string;
  buyPrice: string;
  sellPrice: string;
  tradeDate: string;
  createdAt: string;
}

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
  minOrderSize?: string;
  minTradeIncrement?: string;
  priceIncrement?: string;
}

export interface ActivityDay {
  date: string;
  tradeCount: number;
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
