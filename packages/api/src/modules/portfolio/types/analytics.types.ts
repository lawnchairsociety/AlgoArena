import { AnalyticsPeriod } from '@algoarena/shared';

// ── Return metrics ──

export interface ReturnMetrics {
  totalReturn: string;
  annualizedReturn: string;
  dailyReturns: {
    mean: string;
    stdDev: string;
    min: string;
    max: string;
    positive: number;
    negative: number;
    flat: number;
  };
}

// ── Risk metrics ──

export interface RiskMetrics {
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: string;
  maxDrawdownDuration: number;
  currentDrawdown: string;
  volatility: string;
  beta: number | null;
  alpha: number | null;
  calmarRatio: number | null;
  valueAtRisk95: string | null;
}

// ── Benchmark metrics ──

export interface BenchmarkMetrics {
  symbol: string;
  totalReturn: string;
  sharpeRatio: number | null;
  maxDrawdown: string;
  correlation: number | null;
}

// ── Trading metrics ──

export interface TradingMetrics {
  totalTrades: number;
  winRate: string;
  avgWin: string;
  avgLoss: string;
  profitFactor: string;
  avgHoldingPeriod: string;
  largestWin: string;
  largestLoss: string;
  expectancy: string;
}

// ── Analytics response ──

export interface AnalyticsResponse {
  period: AnalyticsPeriod;
  startDate: string;
  endDate: string;
  startingEquity: string;
  endingEquity: string;
  returns: ReturnMetrics;
  risk: RiskMetrics;
  benchmark: BenchmarkMetrics | null;
  trading: TradingMetrics;
}

// ── History response ──

export interface HistorySnapshot {
  date: string;
  equity: string;
  cash: string;
  positionsValue: string;
  dayPnl: string;
  totalPnl: string;
  drawdown: string;
}

export interface HistoryResponse {
  period: AnalyticsPeriod;
  interval: '1d';
  snapshots: HistorySnapshot[];
}

// ── Enhanced trades response ──

export interface RoundTrip {
  entryPrice: string;
  exitPrice: string;
  pnl: string;
  returnPct: string;
  holdingDays: number;
}

export interface EnhancedTrade {
  id: string;
  orderId: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  total: string;
  timestamp: string;
  roundTrip: RoundTrip | null;
}

export interface EnhancedTradesResponse {
  trades: EnhancedTrade[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
