import { isCryptoSymbol, normalizeCryptoSymbol, PDT_MIN_EQUITY } from '@algoarena/shared';
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
      const symbols = userPositions.map((p) => p.symbol);
      const quotes = await this.marketDataService.getQuotes(symbols);

      for (const pos of userPositions) {
        const qty = new Decimal(pos.quantity);
        const avgCost = new Decimal(pos.avgCostBasis);
        const quote = quotes[pos.symbol];

        if (quote) {
          // Longs use bid, shorts use ask
          const price = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
          positionsValue = positionsValue.plus(qty.mul(price));
          unrealizedPnl = unrealizedPnl.plus(price.minus(avgCost).mul(qty));
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

    const symbols = userPositions.map((p) => p.symbol);
    const quotes = await this.marketDataService.getQuotes(symbols);

    return userPositions.map((pos) => {
      const qty = new Decimal(pos.quantity);
      const avgCost = new Decimal(pos.avgCostBasis);
      const quote = quotes[pos.symbol];
      const side = qty.gt(0) ? 'long' : 'short';

      let currentPrice = new Decimal(0);
      let marketValue = new Decimal(0);
      let unrealizedPnl = new Decimal(0);

      if (quote) {
        currentPrice = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
        marketValue = qty.mul(currentPrice);
        unrealizedPnl = currentPrice.minus(avgCost).mul(qty);
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

    const quote = await this.marketDataService.getQuote(pos.symbol);
    const qty = new Decimal(pos.quantity);
    const avgCost = new Decimal(pos.avgCostBasis);
    const side = qty.gt(0) ? 'long' : 'short';

    const currentPrice = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
    const marketValue = qty.mul(currentPrice);
    const unrealizedPnl = currentPrice.minus(avgCost).mul(qty);

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
