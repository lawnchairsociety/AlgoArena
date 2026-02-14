import { PDT_MAX_DAY_TRADES, PDT_MIN_EQUITY } from '@algoarena/shared';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { and, eq, gte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleProvider } from '../database/drizzle.provider';
import type * as schema from '../database/schema';
import { dayTrades, fills } from '../database/schema';
import { PdtRestrictedPayload } from '../websocket/ws-event.types';

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

@Injectable()
export class PdtService {
  private readonly logger = new Logger(PdtService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Count day trades in a rolling 5-business-day window (approximated as 7 calendar days).
   */
  async countDayTradesInWindow(cuidUserId: string): Promise<number> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7);
    const windowStartDate = windowStart.toISOString().split('T')[0];

    const result = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(dayTrades)
      .where(and(eq(dayTrades.cuidUserId, cuidUserId), gte(dayTrades.tradeDate, windowStartDate)));

    return result[0]?.count ?? 0;
  }

  /**
   * Check PDT rule: if dayTradeCount >= 3 AND equity < $25k → reject.
   * Returns null if OK, or an error message string if blocked.
   */
  async checkPdtRule(cuidUserId: string, equity: Decimal): Promise<string | null> {
    const count = await this.countDayTradesInWindow(cuidUserId);

    if (count >= PDT_MAX_DAY_TRADES && equity.lt(PDT_MIN_EQUITY)) {
      this.eventEmitter.emit('pdt.restricted', {
        cuidUserId,
        dayTradeCount: count,
        equity: equity.toFixed(2),
      } satisfies PdtRestrictedPayload);

      return `PDT rule: ${count} day trades in rolling 5-business-day window with equity $${equity.toFixed(2)} < $25,000`;
    }

    return null;
  }

  /**
   * After a fill, check if there was an opposite-side fill on the same symbol
   * on the same trade date. If so, record a day trade.
   */
  async recordDayTradeIfApplicable(
    tx: Tx,
    cuidUserId: string,
    symbol: string,
    orderId: string,
    side: 'buy' | 'sell',
    fillPrice: string,
    fillQuantity: string,
  ): Promise<number | null> {
    // Get today's date in Eastern Time
    const tradeDate = this.getTradeDateET();
    const oppositeSide = side === 'buy' ? 'sell' : 'buy';

    // Look for a same-day opposite-side fill on the same symbol
    const [oppositeFill] = await tx
      .select()
      .from(fills)
      .where(
        and(
          eq(fills.cuidUserId, cuidUserId),
          eq(fills.symbol, symbol.toUpperCase()),
          eq(fills.side, oppositeSide),
          gte(fills.filledAt, new Date(`${tradeDate}T00:00:00-05:00`)),
        ),
      )
      .limit(1);

    if (!oppositeFill) return null;

    // Determine buy/sell order IDs and prices
    const buyOrderId = side === 'buy' ? orderId : oppositeFill.orderId;
    const sellOrderId = side === 'sell' ? orderId : oppositeFill.orderId;
    const buyPrice = side === 'buy' ? fillPrice : oppositeFill.price;
    const sellPrice = side === 'sell' ? fillPrice : oppositeFill.price;

    // Use the smaller quantity as the day trade quantity
    const qty = Decimal.min(new Decimal(fillQuantity), new Decimal(oppositeFill.quantity));

    await tx.insert(dayTrades).values({
      cuidUserId,
      symbol: symbol.toUpperCase(),
      buyOrderId,
      sellOrderId,
      quantity: qty.toFixed(6),
      buyPrice,
      sellPrice,
      tradeDate,
    });

    this.logger.log(`Recorded day trade for ${cuidUserId} on ${symbol} (${tradeDate})`);

    // Count day trades in window (within tx for consistency)
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7);
    const windowStartDate = windowStart.toISOString().split('T')[0];

    const result = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(dayTrades)
      .where(and(eq(dayTrades.cuidUserId, cuidUserId), gte(dayTrades.tradeDate, windowStartDate)));

    return result[0]?.count ?? 0;
  }

  /**
   * Get today's trade date in Eastern Time (YYYY-MM-DD format).
   */
  private getTradeDateET(): string {
    const now = new Date();
    const et = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    return et; // en-CA format is YYYY-MM-DD
  }
}
