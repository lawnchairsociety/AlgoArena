import { isCryptoSymbol, isOptionSymbol, normalizeCryptoSymbol, PDT_MIN_EQUITY } from '@algoarena/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, desc, eq, gte } from 'drizzle-orm';
import { DrizzleProvider } from '../database/drizzle.provider';
import { cuidUsers, fills, portfolioSnapshots, positions } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { PdtService } from '../trading/pdt.service';
import { TradeHistoryQueryDto } from './dto/portfolio-query.dto';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly pdtService: PdtService,
  ) {}

  async getAccountSummary(userId: string) {
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, userId)).limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));

    const cash = new Decimal(user.cashBalance);
    const startingBalance = new Decimal(user.startingBalance);

    let positionsValue = new Decimal(0);
    let unrealizedPnl = new Decimal(0);

    if (userPositions.length > 0) {
      const quoteMap = await this.fetchQuotesForPositions(userPositions);

      for (const pos of userPositions) {
        const qty = new Decimal(pos.quantity);
        const avgCost = new Decimal(pos.avgCostBasis);
        const multiplier = new Decimal(pos.multiplier ?? '1');
        const q = quoteMap[pos.symbol];

        if (q) {
          const price = qty.gt(0) ? new Decimal(q.bidPrice) : new Decimal(q.askPrice);
          positionsValue = positionsValue.plus(qty.mul(price).mul(multiplier));
          unrealizedPnl = unrealizedPnl.plus(price.minus(avgCost).mul(qty).mul(multiplier));
        }
      }
    }

    const totalEquity = cash.plus(positionsValue);
    const totalPnl = totalEquity.minus(startingBalance);

    const dayTradeCount = await this.pdtService.countDayTradesInWindow(userId);
    const pdtRestricted = user.pdtEnforced && dayTradeCount >= 3 && totalEquity.lt(PDT_MIN_EQUITY);

    return {
      userId: user.id,
      cashBalance: cash.toFixed(2),
      marginUsed: user.marginUsed,
      positionsValue: positionsValue.toFixed(2),
      totalEquity: totalEquity.toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      startingBalance: startingBalance.toFixed(2),
      dayTradeCount,
      pdtEnforced: user.pdtEnforced,
      pdtRestricted,
    };
  }

  async getPositions(userId: string) {
    const userPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));

    if (userPositions.length === 0) {
      return [];
    }

    const quoteMap = await this.fetchQuotesForPositions(userPositions);

    return userPositions.map((pos) => {
      const qty = new Decimal(pos.quantity);
      const avgCost = new Decimal(pos.avgCostBasis);
      const multiplier = new Decimal(pos.multiplier ?? '1');
      const q = quoteMap[pos.symbol];
      const side = qty.gt(0) ? 'long' : 'short';

      let currentPrice = new Decimal(0);
      let marketValue = new Decimal(0);
      let unrealizedPnl = new Decimal(0);

      if (q) {
        currentPrice = qty.gt(0) ? new Decimal(q.bidPrice) : new Decimal(q.askPrice);
        marketValue = qty.mul(currentPrice).mul(multiplier);
        unrealizedPnl = currentPrice.minus(avgCost).mul(qty).mul(multiplier);
      }

      return {
        ...pos,
        side,
        currentPrice: currentPrice.toFixed(4),
        marketValue: marketValue.toFixed(2),
        unrealizedPnl: unrealizedPnl.toFixed(2),
      };
    });
  }

  async getPositionBySymbol(userId: string, symbol: string) {
    const sym = isCryptoSymbol(symbol) ? normalizeCryptoSymbol(symbol) : symbol.toUpperCase();
    const positionId = `${userId}:${sym}`;
    const [pos] = await this.drizzle.db.select().from(positions).where(eq(positions.id, positionId)).limit(1);

    if (!pos) {
      throw new NotFoundException(`No position found for ${sym}`);
    }

    let bidPrice: number;
    let askPrice: number;

    if (isOptionSymbol(pos.symbol)) {
      const optionQuotes = await this.marketDataService.getOptionQuotes([pos.symbol]);
      const oq = optionQuotes[pos.symbol];
      if (!oq) throw new NotFoundException(`No option quote found for ${pos.symbol}`);
      bidPrice = parseFloat(oq.bid);
      askPrice = parseFloat(oq.ask);
    } else {
      const quote = await this.marketDataService.getQuote(pos.symbol);
      bidPrice = quote.bidPrice;
      askPrice = quote.askPrice;
    }

    const qty = new Decimal(pos.quantity);
    const avgCost = new Decimal(pos.avgCostBasis);
    const multiplier = new Decimal(pos.multiplier ?? '1');
    const side = qty.gt(0) ? 'long' : 'short';

    const currentPrice = qty.gt(0) ? new Decimal(bidPrice) : new Decimal(askPrice);
    const marketValue = qty.mul(currentPrice).mul(multiplier);
    const unrealizedPnl = currentPrice.minus(avgCost).mul(qty).mul(multiplier);

    return {
      ...pos,
      side,
      currentPrice: currentPrice.toFixed(4),
      marketValue: marketValue.toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
    };
  }

  async getPortfolioHistory(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return this.drizzle.db
      .select()
      .from(portfolioSnapshots)
      .where(and(eq(portfolioSnapshots.cuidUserId, userId), gte(portfolioSnapshots.snapshotDate, startDateStr)))
      .orderBy(portfolioSnapshots.snapshotDate);
  }

  private async fetchQuotesForPositions(
    userPositions: Array<typeof positions.$inferSelect>,
  ): Promise<Record<string, { bidPrice: number; askPrice: number }>> {
    const equitySymbols: string[] = [];
    const optionSymbols: string[] = [];

    for (const p of userPositions) {
      if (isOptionSymbol(p.symbol)) {
        optionSymbols.push(p.symbol);
      } else {
        equitySymbols.push(p.symbol);
      }
    }

    const result: Record<string, { bidPrice: number; askPrice: number }> = {};

    if (equitySymbols.length > 0) {
      const equityQuotes = await this.marketDataService.getQuotes(equitySymbols);
      for (const [sym, q] of Object.entries(equityQuotes)) {
        result[sym] = { bidPrice: q.bidPrice, askPrice: q.askPrice };
      }
    }

    if (optionSymbols.length > 0) {
      const optionQuotes = await this.marketDataService.getOptionQuotes(optionSymbols);
      for (const [sym, q] of Object.entries(optionQuotes)) {
        result[sym] = { bidPrice: parseFloat(q.bid), askPrice: parseFloat(q.ask) };
      }
    }

    return result;
  }

  async getTradeHistory(userId: string, query: TradeHistoryQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const conditions = [eq(fills.cuidUserId, userId)];

    if (query.symbol) {
      conditions.push(eq(fills.symbol, query.symbol.toUpperCase()));
    }

    return this.drizzle.db
      .select()
      .from(fills)
      .where(and(...conditions))
      .orderBy(desc(fills.filledAt))
      .limit(limit)
      .offset(offset);
  }
}
