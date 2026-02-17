import {
  AnalyticsPeriod,
  CACHE_TTL_ANALYTICS,
  CACHE_TTL_HISTORY,
  MIN_DAYS_FOR_RATIOS,
  RISK_FREE_RATE,
  TRADING_DAYS_PER_YEAR,
} from '@algoarena/shared';
import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import { ValkeyProvider } from '../cache/valkey.provider';
import { DrizzleProvider } from '../database/drizzle.provider';
import { fills, portfolioSnapshots } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { EnhancedTradeHistoryQueryDto } from './dto/portfolio-query.dto';
import {
  AnalyticsResponse,
  BenchmarkMetrics,
  EnhancedTrade,
  EnhancedTradesResponse,
  HistoryResponse,
  HistorySnapshot,
  ReturnMetrics,
  RiskMetrics,
  RoundTrip,
  TradingMetrics,
} from './types/analytics.types';
import { periodToDateRange } from './utils/period.util';

interface FifoMatch {
  entryFillId: string;
  exitFillId: string;
  symbol: string;
  entryPrice: Decimal;
  exitPrice: Decimal;
  quantity: Decimal;
  pnl: Decimal;
  returnPct: Decimal;
  holdingDays: number;
  side: 'long' | 'short';
}

@Injectable()
export class PortfolioAnalyticsService {
  private readonly logger = new Logger(PortfolioAnalyticsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly cache: ValkeyProvider,
  ) {}

  // ── History ──

  async getHistory(userId: string, period: AnalyticsPeriod = '30d'): Promise<HistoryResponse> {
    const cacheKey = `history:${userId}:${period}`;
    const cached = await this.cache.get<HistoryResponse>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = periodToDateRange(period);

    const rows = await this.drizzle.db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.cuidUserId, userId),
          gte(portfolioSnapshots.snapshotDate, startDate),
          lte(portfolioSnapshots.snapshotDate, endDate),
        ),
      )
      .orderBy(asc(portfolioSnapshots.snapshotDate));

    let peak = new Decimal(0);
    const snapshots: HistorySnapshot[] = rows.map((row) => {
      const equity = new Decimal(row.totalEquity);
      if (equity.gt(peak)) peak = equity;
      const drawdown = peak.gt(0) ? equity.minus(peak).div(peak) : new Decimal(0);

      return {
        date: row.snapshotDate,
        equity: equity.toFixed(2),
        cash: new Decimal(row.cashBalance).toFixed(2),
        positionsValue: new Decimal(row.positionsValue).toFixed(2),
        dayPnl: new Decimal(row.dayPnl).toFixed(2),
        totalPnl: new Decimal(row.totalPnl).toFixed(2),
        drawdown: drawdown.toFixed(4),
      };
    });

    const result: HistoryResponse = { period, interval: '1d', snapshots };
    await this.cache.set(cacheKey, result, CACHE_TTL_HISTORY);
    return result;
  }

  // ── FIFO Round-Trip Matching ──

  computeRoundTripsFromFills(
    fillRows: Array<{
      id: string;
      symbol: string;
      side: string;
      quantity: string;
      price: string;
      filledAt: Date;
    }>,
  ): FifoMatch[] {
    const matches: FifoMatch[] = [];

    // Group by symbol
    const bySymbol = new Map<
      string,
      Array<{ id: string; side: string; quantity: Decimal; price: Decimal; filledAt: Date }>
    >();

    for (const f of fillRows) {
      const arr = bySymbol.get(f.symbol) ?? [];
      arr.push({
        id: f.id,
        side: f.side,
        quantity: new Decimal(f.quantity),
        price: new Decimal(f.price),
        filledAt: f.filledAt,
      });
      bySymbol.set(f.symbol, arr);
    }

    for (const [symbol, symbolFills] of bySymbol) {
      // FIFO queue: entries waiting to be closed
      const queue: Array<{
        id: string;
        side: string;
        remaining: Decimal;
        price: Decimal;
        filledAt: Date;
      }> = [];

      for (const fill of symbolFills) {
        // Determine if this fill opens or closes
        if (queue.length === 0) {
          queue.push({
            id: fill.id,
            side: fill.side,
            remaining: fill.quantity,
            price: fill.price,
            filledAt: fill.filledAt,
          });
          continue;
        }

        const front = queue[0];
        const isClosing = front.side !== fill.side;

        if (!isClosing) {
          // Same direction — add to queue
          queue.push({
            id: fill.id,
            side: fill.side,
            remaining: fill.quantity,
            price: fill.price,
            filledAt: fill.filledAt,
          });
          continue;
        }

        // Closing fill — consume from queue
        let remaining = fill.quantity;

        while (remaining.gt(0) && queue.length > 0) {
          const entry = queue[0];
          const matchQty = Decimal.min(remaining, entry.remaining);

          const isLong = entry.side === 'buy';
          const pnl = isLong
            ? fill.price.minus(entry.price).mul(matchQty)
            : entry.price.minus(fill.price).mul(matchQty);

          const returnPct = entry.price.gt(0) ? pnl.div(entry.price.mul(matchQty)) : new Decimal(0);

          const holdingMs = fill.filledAt.getTime() - entry.filledAt.getTime();
          const holdingDays = Math.max(1, Math.round(holdingMs / (1000 * 60 * 60 * 24)));

          matches.push({
            entryFillId: entry.id,
            exitFillId: fill.id,
            symbol,
            entryPrice: entry.price,
            exitPrice: fill.price,
            quantity: matchQty,
            pnl,
            returnPct,
            holdingDays,
            side: isLong ? 'long' : 'short',
          });

          entry.remaining = entry.remaining.minus(matchQty);
          remaining = remaining.minus(matchQty);

          if (entry.remaining.lte(0)) {
            queue.shift();
          }
        }

        // If there's leftover, this fill becomes a new entry in the opposite direction
        if (remaining.gt(0)) {
          queue.push({ id: fill.id, side: fill.side, remaining, price: fill.price, filledAt: fill.filledAt });
        }
      }
    }

    return matches;
  }

  // ── Enhanced Trades ──

  async getTrades(userId: string, query: EnhancedTradeHistoryQueryDto): Promise<EnhancedTradesResponse> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const conditions = [eq(fills.cuidUserId, userId)];

    if (query.symbol) {
      conditions.push(eq(fills.symbol, query.symbol.toUpperCase()));
    }
    if (query.side) {
      conditions.push(eq(fills.side, query.side));
    }
    if (query.startDate) {
      conditions.push(gte(fills.filledAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(fills.filledAt, new Date(query.endDate)));
    }

    const whereClause = and(...conditions);

    // Count query
    const [countResult] = await this.drizzle.db.select({ total: count() }).from(fills).where(whereClause);

    const total = countResult?.total ?? 0;

    // Data query
    const fillRows = await this.drizzle.db
      .select()
      .from(fills)
      .where(whereClause)
      .orderBy(desc(fills.filledAt))
      .limit(limit)
      .offset(offset);

    // Compute round trips for the user's full fill history to build the exit map
    const allFills = await this.drizzle.db
      .select()
      .from(fills)
      .where(eq(fills.cuidUserId, userId))
      .orderBy(asc(fills.filledAt));

    const roundTrips = this.computeRoundTripsFromFills(allFills);
    const exitMap = new Map<string, RoundTrip>();
    for (const rt of roundTrips) {
      exitMap.set(rt.exitFillId, {
        entryPrice: rt.entryPrice.toFixed(4),
        exitPrice: rt.exitPrice.toFixed(4),
        pnl: rt.pnl.toFixed(2),
        returnPct: rt.returnPct.toFixed(4),
        holdingDays: rt.holdingDays,
      });
    }

    const trades: EnhancedTrade[] = fillRows.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      symbol: f.symbol,
      side: f.side,
      quantity: f.quantity,
      price: f.price,
      total: f.totalCost,
      timestamp: f.filledAt.toISOString(),
      roundTrip: exitMap.get(f.id) ?? null,
    }));

    return { trades, pagination: { total, limit, offset } };
  }

  // ── Analytics ──

  async getAnalytics(
    userId: string,
    period: AnalyticsPeriod = 'all',
    benchmark: string = 'SPY',
  ): Promise<AnalyticsResponse> {
    const cacheKey = `analytics:${userId}:${period}:${benchmark}`;
    const cached = await this.cache.get<AnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = periodToDateRange(period);

    const snapshots = await this.drizzle.db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.cuidUserId, userId),
          gte(portfolioSnapshots.snapshotDate, startDate),
          lte(portfolioSnapshots.snapshotDate, endDate),
        ),
      )
      .orderBy(asc(portfolioSnapshots.snapshotDate));

    // Compute daily returns
    const equities = snapshots.map((s) => new Decimal(s.totalEquity));
    const dailyReturns: number[] = [];
    for (let i = 1; i < equities.length; i++) {
      if (equities[i - 1].gt(0)) {
        dailyReturns.push(
          equities[i]
            .minus(equities[i - 1])
            .div(equities[i - 1])
            .toNumber(),
        );
      } else {
        dailyReturns.push(0);
      }
    }

    const startingEquity = equities.length > 0 ? equities[0] : new Decimal(0);
    const endingEquity = equities.length > 0 ? equities[equities.length - 1] : new Decimal(0);

    // Return metrics
    const returns = this.computeReturnMetrics(startingEquity, endingEquity, dailyReturns, snapshots.length);

    // Risk metrics
    const risk = this.computeRiskMetrics(equities, dailyReturns, returns);

    // Benchmark metrics
    let benchmarkResult: BenchmarkMetrics | null = null;
    if (snapshots.length >= MIN_DAYS_FOR_RATIOS) {
      const bmResult = await this.computeBenchmarkMetrics(benchmark, startDate, endDate, dailyReturns, snapshots);
      if (bmResult) {
        benchmarkResult = bmResult.benchmark;
        risk.beta = bmResult.beta;
        risk.alpha = bmResult.alpha;
      }
    }

    // Trading metrics
    const allFills = await this.drizzle.db
      .select()
      .from(fills)
      .where(
        and(
          eq(fills.cuidUserId, userId),
          gte(fills.filledAt, new Date(startDate)),
          lte(fills.filledAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .orderBy(asc(fills.filledAt));

    const roundTrips = this.computeRoundTripsFromFills(allFills);
    const trading = this.computeTradingMetrics(roundTrips);

    const result: AnalyticsResponse = {
      period,
      startDate,
      endDate,
      startingEquity: startingEquity.toFixed(2),
      endingEquity: endingEquity.toFixed(2),
      returns,
      risk,
      benchmark: benchmarkResult,
      trading,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL_ANALYTICS);
    return result;
  }

  // ── Private: Return Metrics ──

  private computeReturnMetrics(
    startingEquity: Decimal,
    endingEquity: Decimal,
    dailyReturns: number[],
    dayCount: number,
  ): ReturnMetrics {
    const totalReturn = startingEquity.gt(0) ? endingEquity.minus(startingEquity).div(startingEquity) : new Decimal(0);

    let annualizedReturn = new Decimal(0);
    if (dayCount > 1 && startingEquity.gt(0)) {
      const years = (dayCount - 1) / TRADING_DAYS_PER_YEAR;
      if (years > 0 && endingEquity.div(startingEquity).gt(0)) {
        annualizedReturn = new Decimal(endingEquity.div(startingEquity).toNumber() ** (1 / years) - 1);
      }
    }

    const meanVal = dailyReturns.length > 0 ? this.mean(dailyReturns) : 0;
    const stdDevVal = dailyReturns.length > 1 ? this.stdDev(dailyReturns) : 0;
    const minVal = dailyReturns.length > 0 ? Math.min(...dailyReturns) : 0;
    const maxVal = dailyReturns.length > 0 ? Math.max(...dailyReturns) : 0;
    const positive = dailyReturns.filter((r) => r > 0).length;
    const negative = dailyReturns.filter((r) => r < 0).length;
    const flat = dailyReturns.filter((r) => r === 0).length;

    return {
      totalReturn: totalReturn.toFixed(4),
      annualizedReturn: annualizedReturn.toFixed(4),
      dailyReturns: {
        mean: meanVal.toFixed(6),
        stdDev: stdDevVal.toFixed(6),
        min: minVal.toFixed(6),
        max: maxVal.toFixed(6),
        positive,
        negative,
        flat,
      },
    };
  }

  // ── Private: Risk Metrics ──

  private computeRiskMetrics(equities: Decimal[], dailyReturns: number[], returns: ReturnMetrics): RiskMetrics {
    const hasSufficientData = dailyReturns.length >= MIN_DAYS_FOR_RATIOS;

    // Max drawdown
    let maxDrawdown = new Decimal(0);
    let maxDrawdownDuration = 0;
    let currentDrawdown = new Decimal(0);
    let peak = new Decimal(0);
    let peakIdx = 0;

    for (let i = 0; i < equities.length; i++) {
      if (equities[i].gt(peak)) {
        peak = equities[i];
        peakIdx = i;
      }
      if (peak.gt(0)) {
        const dd = equities[i].minus(peak).div(peak);
        if (dd.lt(maxDrawdown)) {
          maxDrawdown = dd;
          maxDrawdownDuration = i - peakIdx;
        }
        if (i === equities.length - 1) {
          currentDrawdown = dd;
        }
      }
    }

    // Volatility
    const stdDevDaily = dailyReturns.length > 1 ? this.stdDev(dailyReturns) : 0;
    const volatility = stdDevDaily * Math.sqrt(TRADING_DAYS_PER_YEAR);

    // Sharpe ratio
    let sharpeRatio: number | null = null;
    if (hasSufficientData && stdDevDaily > 0) {
      const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
      const meanReturn = this.mean(dailyReturns);
      sharpeRatio = Number((((meanReturn - dailyRf) / stdDevDaily) * Math.sqrt(TRADING_DAYS_PER_YEAR)).toFixed(4));
    }

    // Sortino ratio
    let sortinoRatio: number | null = null;
    if (hasSufficientData) {
      const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
      const dsd = this.downsideDeviation(dailyReturns, dailyRf);
      if (dsd > 0) {
        const meanReturn = this.mean(dailyReturns);
        sortinoRatio = Number((((meanReturn - dailyRf) / dsd) * Math.sqrt(TRADING_DAYS_PER_YEAR)).toFixed(4));
      }
    }

    // Calmar ratio
    let calmarRatio: number | null = null;
    if (hasSufficientData && maxDrawdown.lt(0)) {
      const annReturn = parseFloat(returns.annualizedReturn);
      calmarRatio = Number((annReturn / Math.abs(maxDrawdown.toNumber())).toFixed(4));
    }

    // Value at Risk (95%)
    let valueAtRisk95: string | null = null;
    if (hasSufficientData) {
      const sorted = [...dailyReturns].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * 0.05);
      valueAtRisk95 = sorted[idx].toFixed(6);
    }

    return {
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDrawdown.toFixed(4),
      maxDrawdownDuration,
      currentDrawdown: currentDrawdown.toFixed(4),
      volatility: volatility.toFixed(4),
      beta: null, // Set by benchmark computation
      alpha: null,
      calmarRatio,
      valueAtRisk95,
    };
  }

  // ── Private: Benchmark Metrics ──

  private async computeBenchmarkMetrics(
    symbol: string,
    startDate: string,
    endDate: string,
    portfolioReturns: number[],
    snapshots: Array<{ snapshotDate: string }>,
  ): Promise<{ benchmark: BenchmarkMetrics; beta: number | null; alpha: number | null } | null> {
    try {
      const barsResponse = await this.marketDataService.getBars(symbol, {
        timeframe: '1Day',
        start: startDate,
        end: endDate,
      });

      if (!barsResponse.bars || barsResponse.bars.length < 2) {
        return null;
      }

      // Build date-to-bar map for alignment
      const barMap = new Map<string, number>();
      for (const bar of barsResponse.bars) {
        const dateKey = bar.timestamp.split('T')[0];
        barMap.set(dateKey, bar.close);
      }

      // Align: compute benchmark returns for matching dates
      const benchReturns: number[] = [];
      const alignedPortfolioReturns: number[] = [];

      for (let i = 1; i < snapshots.length; i++) {
        const prevDate = snapshots[i - 1].snapshotDate;
        const currDate = snapshots[i].snapshotDate;
        const prevClose = barMap.get(prevDate);
        const currClose = barMap.get(currDate);

        if (prevClose && currClose && prevClose > 0 && i - 1 < portfolioReturns.length) {
          benchReturns.push((currClose - prevClose) / prevClose);
          alignedPortfolioReturns.push(portfolioReturns[i - 1]);
        }
      }

      if (benchReturns.length < MIN_DAYS_FOR_RATIOS) {
        return null;
      }

      // Benchmark total return
      const firstBar = barsResponse.bars[0];
      const lastBar = barsResponse.bars[barsResponse.bars.length - 1];
      const benchTotalReturn = (lastBar.close - firstBar.close) / firstBar.close;

      // Benchmark Sharpe
      const benchMean = this.mean(benchReturns);
      const benchStdDev = this.stdDev(benchReturns);
      const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
      const benchSharpe =
        benchStdDev > 0
          ? Number((((benchMean - dailyRf) / benchStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)).toFixed(4))
          : null;

      // Benchmark max drawdown
      let benchPeak = 0;
      let benchMaxDD = 0;
      for (const bar of barsResponse.bars) {
        if (bar.close > benchPeak) benchPeak = bar.close;
        if (benchPeak > 0) {
          const dd = (bar.close - benchPeak) / benchPeak;
          if (dd < benchMaxDD) benchMaxDD = dd;
        }
      }

      // Beta and correlation
      const benchVar = this.variance(benchReturns);
      const cov = this.covariance(alignedPortfolioReturns, benchReturns);
      const beta = benchVar > 0 ? Number((cov / benchVar).toFixed(4)) : null;

      // Alpha (CAPM)
      const alpha =
        beta !== null
          ? Number(
              (
                this.mean(alignedPortfolioReturns) * TRADING_DAYS_PER_YEAR -
                (RISK_FREE_RATE + beta * (benchMean * TRADING_DAYS_PER_YEAR - RISK_FREE_RATE))
              ).toFixed(4),
            )
          : null;

      // Correlation
      const pStdDev = this.stdDev(alignedPortfolioReturns);
      const correlation = pStdDev > 0 && benchStdDev > 0 ? Number((cov / (pStdDev * benchStdDev)).toFixed(4)) : null;

      return {
        benchmark: {
          symbol,
          totalReturn: benchTotalReturn.toFixed(4),
          sharpeRatio: benchSharpe,
          maxDrawdown: benchMaxDD.toFixed(4),
          correlation,
        },
        beta,
        alpha,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch benchmark data for ${symbol}: ${error}`);
      return null;
    }
  }

  // ── Private: Trading Metrics ──

  private computeTradingMetrics(roundTrips: FifoMatch[]): TradingMetrics {
    if (roundTrips.length === 0) {
      return {
        totalTrades: 0,
        winRate: '0.0000',
        avgWin: '0.00',
        avgLoss: '0.00',
        profitFactor: '0.00',
        avgHoldingPeriod: '0.0',
        largestWin: '0.00',
        largestLoss: '0.00',
        expectancy: '0.00',
      };
    }

    const wins = roundTrips.filter((rt) => rt.pnl.gt(0));
    const losses = roundTrips.filter((rt) => rt.pnl.lt(0));

    const winRate = new Decimal(wins.length).div(roundTrips.length);

    const avgWin =
      wins.length > 0 ? wins.reduce((sum, rt) => sum.plus(rt.pnl), new Decimal(0)).div(wins.length) : new Decimal(0);

    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, rt) => sum.plus(rt.pnl), new Decimal(0)).div(losses.length)
        : new Decimal(0);

    const totalWins = wins.reduce((sum, rt) => sum.plus(rt.pnl), new Decimal(0));
    const totalLosses = losses.reduce((sum, rt) => sum.plus(rt.pnl.abs()), new Decimal(0));
    const profitFactor = totalLosses.gt(0) ? totalWins.div(totalLosses) : new Decimal(0);

    const totalHoldingDays = roundTrips.reduce((sum, rt) => sum + rt.holdingDays, 0);
    const avgHoldingPeriod = totalHoldingDays / roundTrips.length;

    const largestWin =
      wins.length > 0 ? wins.reduce((max, rt) => (rt.pnl.gt(max) ? rt.pnl : max), new Decimal(0)) : new Decimal(0);

    const largestLoss =
      losses.length > 0 ? losses.reduce((min, rt) => (rt.pnl.lt(min) ? rt.pnl : min), new Decimal(0)) : new Decimal(0);

    const totalPnl = roundTrips.reduce((sum, rt) => sum.plus(rt.pnl), new Decimal(0));
    const expectancy = totalPnl.div(roundTrips.length);

    return {
      totalTrades: roundTrips.length,
      winRate: winRate.toFixed(4),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      avgHoldingPeriod: avgHoldingPeriod.toFixed(1),
      largestWin: largestWin.toFixed(2),
      largestLoss: largestLoss.toFixed(2),
      expectancy: expectancy.toFixed(2),
    };
  }

  // ── Private: Statistical Helpers (native JS floats) ──

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  }

  private variance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    return arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  }

  private stdDev(arr: number[]): number {
    return Math.sqrt(this.variance(arr));
  }

  private covariance(arr1: number[], arr2: number[]): number {
    const n = Math.min(arr1.length, arr2.length);
    if (n < 2) return 0;
    const m1 = this.mean(arr1.slice(0, n));
    const m2 = this.mean(arr2.slice(0, n));
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (arr1[i] - m1) * (arr2[i] - m2);
    }
    return sum / (n - 1);
  }

  private downsideDeviation(arr: number[], threshold: number): number {
    const downsideReturns = arr.filter((r) => r < threshold).map((r) => (r - threshold) ** 2);
    if (downsideReturns.length === 0) return 0;
    return Math.sqrt(downsideReturns.reduce((sum, v) => sum + v, 0) / downsideReturns.length);
  }
}
