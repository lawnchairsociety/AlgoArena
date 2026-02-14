import { MAINTENANCE_MARGIN_REQUIREMENT, OrderSide } from '@algoarena/shared';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DrizzleProvider } from '../database/drizzle.provider';
import { borrows, cuidUsers, orders, portfolioSnapshots, positions } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { Quote } from '../market-data/types/market-data-provider.types';
import { PortfolioService } from '../portfolio/portfolio.service';
import { OrderEngineService } from '../trading/order-engine.service';
import { MarginLiquidationPayload, MarginWarningPayload, OrderEventPayload } from '../websocket/ws-event.types';
import { PriceMonitorService } from './price-monitor.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly locks = new Map<string, boolean>();

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly orderEngine: OrderEngineService,
    private readonly priceMonitor: PriceMonitorService,
    readonly _portfolioService: PortfolioService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('SchedulerService initialized');
  }

  // ── Price Monitor: every minute ──

  @Cron('0 * * * * *')
  async handlePriceMonitor(): Promise<void> {
    if (this.isLocked('priceMonitor')) return;

    try {
      this.lock('priceMonitor');
      const clock = await this.marketDataService.getClock();
      if (!clock.isOpen) return;

      await this.priceMonitor.evaluatePendingOrders();
    } catch (error) {
      this.logger.error(`Price monitor error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('priceMonitor');
    }
  }

  // ── Market Open: 9:30 AM ET, Mon-Fri ──

  @Cron('0 30 9 * * 1-5', { timeZone: 'America/New_York' })
  async handleMarketOpen(): Promise<void> {
    if (this.isLocked('marketOpen')) return;

    try {
      this.lock('marketOpen');
      if (!(await this.isTradingDay())) return;

      this.logger.log('Market open: filling queued market orders');
      await this.priceMonitor.fillQueuedMarketOrders();
    } catch (error) {
      this.logger.error(`Market open error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('marketOpen');
    }
  }

  // ── Market Close: 4:00 PM ET, Mon-Fri ──

  @Cron('0 0 16 * * 1-5', { timeZone: 'America/New_York' })
  async handleMarketClose(): Promise<void> {
    if (this.isLocked('marketClose')) return;

    try {
      this.lock('marketClose');
      if (!(await this.isTradingDay())) return;

      this.logger.log('Market close: expiring unfilled day orders');

      const result = await this.drizzle.db
        .update(orders)
        .set({
          status: 'expired',
          expiredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(inArray(orders.status, ['pending', 'partially_filled']), eq(orders.timeInForce, 'day')))
        .returning({
          id: orders.id,
          cuidUserId: orders.cuidUserId,
          symbol: orders.symbol,
          side: orders.side,
          type: orders.type,
          quantity: orders.quantity,
        });

      for (const expired of result) {
        this.eventEmitter.emit('order.expired', {
          cuidUserId: expired.cuidUserId,
          orderId: expired.id,
          symbol: expired.symbol,
          side: expired.side,
          type: expired.type,
          quantity: expired.quantity,
          status: 'expired',
        } satisfies OrderEventPayload);
      }

      this.logger.log(`Market close: expired ${result.length} day orders`);
    } catch (error) {
      this.logger.error(`Market close error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('marketClose');
    }
  }

  // ── Portfolio Snapshots: 4:30 PM ET, Mon-Fri ──

  @Cron('0 30 16 * * 1-5', { timeZone: 'America/New_York' })
  async handlePortfolioSnapshots(): Promise<void> {
    if (this.isLocked('portfolioSnapshots')) return;

    try {
      this.lock('portfolioSnapshots');
      if (!(await this.isTradingDay())) return;

      this.logger.log('Taking portfolio snapshots');
      const todayET = this.getTodayET();

      const allUsers = await this.drizzle.db.select().from(cuidUsers);

      if (allUsers.length === 0) return;

      // Get all positions across all users
      const allPositions = await this.drizzle.db.select().from(positions);

      // Batch-fetch all unique symbols once
      const allSymbols = [...new Set(allPositions.map((p) => p.symbol))];
      const quotes = allSymbols.length > 0 ? await this.marketDataService.getQuotes(allSymbols) : {};

      const snapshots: Array<typeof portfolioSnapshots.$inferInsert> = [];

      for (const user of allUsers) {
        const cash = new Decimal(user.cashBalance);
        const startingBalance = new Decimal(user.startingBalance);
        const userPositions = allPositions.filter((p) => p.cuidUserId === user.id);

        let positionsValue = new Decimal(0);
        for (const pos of userPositions) {
          const qty = new Decimal(pos.quantity);
          const quote = quotes[pos.symbol];
          if (quote) {
            const price = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
            positionsValue = positionsValue.plus(qty.mul(price));
          }
        }

        const totalEquity = cash.plus(positionsValue);
        const totalPnl = totalEquity.minus(startingBalance);

        // dayPnl: difference from previous snapshot or startingBalance
        const dayPnl = totalPnl; // simplified: total PnL since inception

        snapshots.push({
          cuidUserId: user.id,
          snapshotDate: todayET,
          cashBalance: cash.toFixed(2),
          positionsValue: positionsValue.toFixed(2),
          totalEquity: totalEquity.toFixed(2),
          dayPnl: dayPnl.toFixed(2),
          totalPnl: totalPnl.toFixed(2),
        });
      }

      if (snapshots.length > 0) {
        await this.drizzle.db.insert(portfolioSnapshots).values(snapshots);
      }

      this.logger.log(`Portfolio snapshots: saved ${snapshots.length} snapshots for ${todayET}`);
    } catch (error) {
      this.logger.error(`Portfolio snapshot error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('portfolioSnapshots');
    }
  }

  // ── Borrow Fee Accrual: 5:00 PM ET, daily (incl. weekends) ──

  @Cron('0 0 17 * * *', { timeZone: 'America/New_York' })
  async handleBorrowFeeAccrual(): Promise<void> {
    if (this.isLocked('borrowFees')) return;

    try {
      this.lock('borrowFees');
      this.logger.log('Accruing borrow fees');

      const openBorrows = await this.drizzle.db.select().from(borrows).where(isNull(borrows.closedAt));

      if (openBorrows.length === 0) return;

      // Batch-fetch quotes for all borrowed symbols
      const symbols = [...new Set(openBorrows.map((b) => b.symbol))];
      const quotes = await this.marketDataService.getQuotes(symbols);

      // Group borrows by user for efficient cash deductions
      const feesByUser = new Map<string, Decimal>();

      for (const borrow of openBorrows) {
        try {
          const quote = quotes[borrow.symbol];
          if (!quote) continue;

          const qty = new Decimal(borrow.quantity);
          const rate = new Decimal(borrow.borrowRate);
          const currentPrice = new Decimal(quote.askPrice); // ask price for short valuation
          const dailyFee = rate.div(365).mul(qty).mul(currentPrice);

          const newAccruedFees = new Decimal(borrow.accruedFees).plus(dailyFee);

          await this.drizzle.db
            .update(borrows)
            .set({ accruedFees: newAccruedFees.toFixed(2) })
            .where(eq(borrows.id, borrow.id));

          const userFees = feesByUser.get(borrow.cuidUserId) ?? new Decimal(0);
          feesByUser.set(borrow.cuidUserId, userFees.plus(dailyFee));
        } catch (error) {
          this.logger.error(
            `Error accruing fee for borrow ${borrow.id}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      // Deduct fees from user cash balances in transactions with row locking
      for (const [userId, totalFee] of feesByUser) {
        try {
          await this.drizzle.db.transaction(async (tx) => {
            const [user] = await tx.select().from(cuidUsers).where(eq(cuidUsers.id, userId)).for('update');

            if (!user) return;

            const newCash = new Decimal(user.cashBalance).minus(totalFee);
            await tx
              .update(cuidUsers)
              .set({ cashBalance: newCash.toFixed(2) })
              .where(eq(cuidUsers.id, userId));
          });
        } catch (error) {
          this.logger.error(
            `Error deducting borrow fees for user ${userId}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      this.logger.log(`Borrow fees: accrued for ${openBorrows.length} borrows across ${feesByUser.size} users`);
    } catch (error) {
      this.logger.error(`Borrow fee accrual error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('borrowFees');
    }
  }

  // ── Margin Check: 5:15 PM ET, Mon-Fri ──

  @Cron('0 15 17 * * 1-5', { timeZone: 'America/New_York' })
  async handleMarginCheck(): Promise<void> {
    if (this.isLocked('marginCheck')) return;

    try {
      this.lock('marginCheck');
      if (!(await this.isTradingDay())) return;

      this.logger.log('Running margin check');

      // Load all positions — filter shorts in code since numeric comparison is complex
      const shortPositions = await this.drizzle.db.select().from(positions);

      // Group by user and filter to only shorts
      const userShorts = new Map<string, Array<typeof positions.$inferSelect>>();
      for (const pos of shortPositions) {
        if (new Decimal(pos.quantity).lt(0)) {
          const existing = userShorts.get(pos.cuidUserId) ?? [];
          existing.push(pos);
          userShorts.set(pos.cuidUserId, existing);
        }
      }

      if (userShorts.size === 0) return;

      // Batch-fetch all needed quotes
      const allSymbols = [
        ...new Set(
          Array.from(userShorts.values())
            .flat()
            .map((p) => p.symbol),
        ),
      ];
      const quotes = await this.marketDataService.getQuotes(allSymbols);

      for (const [userId, shorts] of userShorts) {
        try {
          await this.checkAndLiquidateIfNeeded(userId, shorts, quotes);
        } catch (error) {
          this.logger.error(`Margin check error for user ${userId}: ${error instanceof Error ? error.message : error}`);
        }
      }

      this.logger.log(`Margin check: evaluated ${userShorts.size} users with short positions`);
    } catch (error) {
      this.logger.error(`Margin check error: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.unlock('marginCheck');
    }
  }

  // ── Private Helpers ──

  private async checkAndLiquidateIfNeeded(
    userId: string,
    shorts: Array<typeof positions.$inferSelect>,
    quotes: Record<string, Quote>,
  ): Promise<void> {
    // Load user and ALL positions for equity calculation
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, userId)).limit(1);

    if (!user) return;

    const allUserPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));

    // Compute total equity
    const cash = new Decimal(user.cashBalance);
    let positionsValue = new Decimal(0);
    for (const pos of allUserPositions) {
      const qty = new Decimal(pos.quantity);
      const quote = quotes[pos.symbol];
      if (quote) {
        const price = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
        positionsValue = positionsValue.plus(qty.mul(price));
      }
    }
    const totalEquity = cash.plus(positionsValue);

    // Compute maintenance requirement for shorts
    let maintenanceReq = new Decimal(0);
    for (const pos of shorts) {
      const qty = new Decimal(pos.quantity).abs();
      const quote = quotes[pos.symbol];
      if (quote) {
        maintenanceReq = maintenanceReq.plus(qty.mul(new Decimal(quote.askPrice)).mul(MAINTENANCE_MARGIN_REQUIREMENT));
      }
    }

    if (totalEquity.gte(maintenanceReq)) return;

    this.logger.warn(
      `User ${userId} margin call: equity $${totalEquity.toFixed(2)} < maintenance $${maintenanceReq.toFixed(2)}`,
    );

    // Emit margin warning
    this.eventEmitter.emit('margin.warning', {
      cuidUserId: userId,
      equity: totalEquity.toFixed(2),
      maintenanceRequired: maintenanceReq.toFixed(2),
      shortPositions: shorts.map((p) => {
        const quote = quotes[p.symbol];
        return {
          symbol: p.symbol,
          quantity: new Decimal(p.quantity).abs().toFixed(6),
          currentPrice: quote ? quote.askPrice.toString() : '0',
        };
      }),
    } satisfies MarginWarningPayload);

    // Auto-liquidate shorts until compliant
    for (const pos of shorts) {
      const qty = new Decimal(pos.quantity).abs();
      const quote = quotes[pos.symbol];
      if (!quote) continue;

      try {
        // Insert a market buy order to cover
        const [coverOrder] = await this.drizzle.db
          .insert(orders)
          .values({
            cuidUserId: userId,
            symbol: pos.symbol,
            side: 'buy' as const,
            type: 'market' as const,
            timeInForce: 'day' as const,
            quantity: qty.toFixed(6),
          })
          .returning();

        const fillPrice = this.orderEngine.getMarketFillPrice('buy' as OrderSide, quote);

        await this.orderEngine.executeFill({
          orderId: coverOrder.id,
          fillPrice,
          fillQuantity: qty,
        });

        this.logger.warn(
          `Auto-liquidated short ${pos.symbol} for user ${userId}: ${qty.toFixed(6)} shares @ $${fillPrice.toFixed(4)}`,
        );

        this.eventEmitter.emit('margin.liquidation', {
          cuidUserId: userId,
          symbol: pos.symbol,
          quantity: qty.toFixed(6),
          fillPrice: fillPrice.toFixed(4),
          coverOrderId: coverOrder.id,
        } satisfies MarginLiquidationPayload);

        // Re-check equity after liquidation
        const [updatedUser] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, userId)).limit(1);

        if (!updatedUser) break;

        const updatedPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));

        let updatedPosValue = new Decimal(0);
        for (const p of updatedPositions) {
          const q = new Decimal(p.quantity);
          const qt = quotes[p.symbol];
          if (qt) {
            const pr = q.gt(0) ? new Decimal(qt.bidPrice) : new Decimal(qt.askPrice);
            updatedPosValue = updatedPosValue.plus(q.mul(pr));
          }
        }

        const updatedEquity = new Decimal(updatedUser.cashBalance).plus(updatedPosValue);

        // Recalculate maintenance for remaining shorts
        let updatedMaintenance = new Decimal(0);
        for (const p of updatedPositions) {
          const q = new Decimal(p.quantity);
          if (q.lt(0)) {
            const qt = quotes[p.symbol];
            if (qt) {
              updatedMaintenance = updatedMaintenance.plus(
                q.abs().mul(new Decimal(qt.askPrice)).mul(MAINTENANCE_MARGIN_REQUIREMENT),
              );
            }
          }
        }

        if (updatedEquity.gte(updatedMaintenance)) {
          this.logger.log(`User ${userId} now compliant after auto-liquidation`);
          break;
        }
      } catch (error) {
        this.logger.error(
          `Error auto-liquidating ${pos.symbol} for user ${userId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private async isTradingDay(): Promise<boolean> {
    const todayET = this.getTodayET();
    const calendar = await this.marketDataService.getCalendar({
      start: todayET,
      end: todayET,
    });
    return calendar.length > 0;
  }

  private getTodayET(): string {
    const now = new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  private isLocked(job: string): boolean {
    return this.locks.get(job) === true;
  }

  private lock(job: string): void {
    this.locks.set(job, true);
  }

  private unlock(job: string): void {
    this.locks.set(job, false);
  }
}
