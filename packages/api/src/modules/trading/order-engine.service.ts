import {
  BORROW_RATE_EASY,
  BORROW_RATE_MODERATE,
  INITIAL_MARGIN_REQUIREMENT,
  isCryptoSymbol,
  isOptionSymbol,
  OPTIONS_MULTIPLIER,
  OrderSide,
  OrderType,
  parseOptionSymbol,
} from '@algoarena/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleProvider } from '../database/drizzle.provider';
import type * as schema from '../database/schema';
import { borrowFeeTiers, borrows, cuidUsers, fills, orders, positions } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { Quote } from '../market-data/types/market-data-provider.types';
import { OrderEventPayload, PdtWarningPayload } from '../websocket/ws-event.types';
import { PdtService } from './pdt.service';

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

interface FillParams {
  orderId: string;
  fillPrice: Decimal;
  fillQuantity: Decimal;
  multiplier?: number; // defaults to 1
  session?: string;
}

@Injectable()
export class OrderEngineService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly pdtService: PdtService,
    private readonly marketDataService: MarketDataService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute a fill within a DB transaction with row locking.
   */
  async executeFill(params: FillParams): Promise<void> {
    const { orderId, fillPrice, fillQuantity } = params;

    let eventType: 'order.filled' | 'order.partially_filled' | null = null;
    let orderEventPayload: OrderEventPayload | null = null;
    let pdtCount: number | null = null;
    let eventCuidUserId: string | null = null;

    await this.drizzle.db.transaction(async (tx) => {
      // 1. Lock the order row
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');

      if (!order || (order.status !== 'pending' && order.status !== 'partially_filled')) {
        throw new BadRequestException(`Order ${orderId} is not fillable (status: ${order?.status})`);
      }

      // 2. Lock the user row
      const [user] = await tx.select().from(cuidUsers).where(eq(cuidUsers.id, order.cuidUserId)).for('update');

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // 3. Lock the position row (if exists)
      const positionId = `${order.cuidUserId}:${order.symbol.toUpperCase()}`;
      const [existingPosition] = await tx.select().from(positions).where(eq(positions.id, positionId)).for('update');

      // 4. Re-check buying power at fill time
      const cash = new Decimal(user.cashBalance);
      const marginUsed = new Decimal(user.marginUsed);
      const multiplier = new Decimal(params.multiplier ?? 1);
      const totalCost = fillPrice.mul(fillQuantity).mul(multiplier);
      const currentPositionQty = existingPosition ? new Decimal(existingPosition.quantity) : new Decimal(0);

      // Determine if this is a short sell or a cover
      const isShortSell = order.side === 'sell' && currentPositionQty.lte(0); // no long or already short
      const isPartialShortSell =
        order.side === 'sell' && currentPositionQty.gt(0) && fillQuantity.gt(currentPositionQty); // selling more than long position

      if (order.side === 'buy') {
        const isCover = currentPositionQty.lt(0);
        if (isCover) {
          // Covering: need cash for the buy
          if (cash.lt(totalCost)) {
            throw new BadRequestException('Insufficient funds to cover short position');
          }
        } else {
          // Regular buy
          if (cash.lt(totalCost)) {
            throw new BadRequestException('Insufficient funds');
          }
        }
      } else {
        // Sell side
        if (!isShortSell && !isPartialShortSell) {
          // Selling existing long — verify quantity
          if (currentPositionQty.lt(fillQuantity)) {
            throw new BadRequestException(
              `Insufficient position: have ${currentPositionQty.toFixed(6)}, trying to sell ${fillQuantity.toFixed(6)}`,
            );
          }
        } else {
          // Short sell — verify margin
          const shortQty = isPartialShortSell ? fillQuantity.minus(currentPositionQty) : fillQuantity;
          const marginRequired = fillPrice.mul(shortQty).mul(INITIAL_MARGIN_REQUIREMENT);
          const availableMargin = cash.minus(marginUsed);
          if (availableMargin.lt(marginRequired)) {
            throw new BadRequestException(
              `Insufficient margin for short sell: need $${marginRequired.toFixed(2)}, available $${availableMargin.toFixed(2)}`,
            );
          }
        }
      }

      // 5. Insert fill record
      await tx.insert(fills).values({
        orderId: order.id,
        cuidUserId: order.cuidUserId,
        symbol: order.symbol.toUpperCase(),
        side: order.side,
        quantity: fillQuantity.toFixed(6),
        price: fillPrice.toFixed(4),
        totalCost: totalCost.toFixed(2),
      });

      // 6. Update order
      const newFilledQty = new Decimal(order.filledQuantity).plus(fillQuantity);
      const orderQty = new Decimal(order.quantity);
      const isFullyFilled = newFilledQty.gte(orderQty);

      // Calculate new average fill price
      const prevFilledQty = new Decimal(order.filledQuantity);
      const prevAvgPrice = order.avgFillPrice ? new Decimal(order.avgFillPrice) : new Decimal(0);
      const newAvgFillPrice = prevFilledQty.isZero()
        ? fillPrice
        : prevAvgPrice.mul(prevFilledQty).plus(fillPrice.mul(fillQuantity)).div(newFilledQty);

      await tx
        .update(orders)
        .set({
          filledQuantity: newFilledQty.toFixed(6),
          avgFillPrice: newAvgFillPrice.toFixed(4),
          status: isFullyFilled ? 'filled' : 'partially_filled',
          filledAt: isFullyFilled ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // Capture event data for post-transaction emission
      eventType = isFullyFilled ? 'order.filled' : 'order.partially_filled';
      eventCuidUserId = order.cuidUserId;
      orderEventPayload = {
        cuidUserId: order.cuidUserId,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        status: isFullyFilled ? 'filled' : 'partially_filled',
        filledQuantity: newFilledQty.toFixed(6),
        avgFillPrice: newAvgFillPrice.toFixed(4),
        fillPrice: fillPrice.toFixed(4),
        fillQuantity: fillQuantity.toFixed(6),
        highWaterMark: order.highWaterMark ?? null,
        trailingStopPrice: order.trailingStopPrice ?? null,
        trailPercent: order.trailPercent ?? null,
        trailPrice: order.trailPrice ?? null,
        ...(params.session ? { session: params.session } : {}),
        ...(order.extendedHours ? { extendedHours: true } : {}),
      };

      // 7. Update cash balance
      let newCash = cash;
      if (order.side === 'buy') {
        // Buy (long or cover): cash -= totalCost
        newCash = cash.minus(totalCost);
      } else {
        // Sell
        if (isShortSell) {
          // Open short: no cash change (margin reserved instead)
          // newCash stays the same
        } else if (isPartialShortSell) {
          // Close long portion: cash += long close proceeds
          const longCloseProceeds = fillPrice.mul(currentPositionQty);
          newCash = cash.plus(longCloseProceeds);
          // Short portion: no cash change (margin reserved)
        } else {
          // Close long: cash += totalCost
          newCash = cash.plus(totalCost);
        }
      }

      // 8. Update position
      await this.updatePosition(
        tx,
        order.cuidUserId,
        order.symbol.toUpperCase(),
        order.side,
        fillQuantity,
        fillPrice,
        existingPosition,
      );

      // 9. Handle borrows (short open/close — equities only, skip crypto + options)
      const newMarginUsed =
        isCryptoSymbol(order.symbol) || isOptionSymbol(order.symbol)
          ? marginUsed
          : await this.handleBorrows(
              tx,
              order.cuidUserId,
              order.symbol.toUpperCase(),
              order.side,
              fillQuantity,
              fillPrice,
              currentPositionQty,
              marginUsed,
            );

      // Write back cash + margin
      await tx
        .update(cuidUsers)
        .set({
          cashBalance: newCash.toFixed(2),
          marginUsed: newMarginUsed.toFixed(2),
        })
        .where(eq(cuidUsers.id, order.cuidUserId));

      // 10. Record day trade if applicable (equities only — skip crypto + options)
      if (!isCryptoSymbol(order.symbol) && !isOptionSymbol(order.symbol)) {
        pdtCount = await this.pdtService.recordDayTradeIfApplicable(
          tx,
          order.cuidUserId,
          order.symbol.toUpperCase(),
          orderId,
          order.side,
          fillPrice.toFixed(4),
          fillQuantity.toFixed(6),
        );
      }
    });

    // === Bracket child creation + OCO cancellation (on full fill) ===
    let bracketChildren: { takeProfitOrderId?: string; stopLossOrderId?: string } | undefined;
    let cancelledLinkedOrder: typeof orders.$inferSelect | null = null;

    if (eventType === 'order.filled') {
      const [filledOrder] = await this.drizzle.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

      if (filledOrder) {
        // Create bracket children if this is a bracket entry
        if (filledOrder.bracketRole === 'entry' && filledOrder.bracketGroupId) {
          bracketChildren = await this.createBracketChildren(filledOrder);
        }

        // Cancel OCO-linked order
        if (filledOrder.linkedOrderId) {
          cancelledLinkedOrder = await this.cancelOcoLinkedOrder(filledOrder);
        }
      }
    }

    // Emit fill event (with bracket info if applicable)
    if (eventType && orderEventPayload) {
      const payload = orderEventPayload as OrderEventPayload;
      if (bracketChildren) {
        payload.bracket = bracketChildren;
      }
      this.eventEmitter.emit(eventType, payload);
    }

    // Emit OCO cancel event for the linked order
    if (cancelledLinkedOrder) {
      this.eventEmitter.emit('order.cancelled', {
        cuidUserId: cancelledLinkedOrder.cuidUserId,
        orderId: cancelledLinkedOrder.id,
        symbol: cancelledLinkedOrder.symbol,
        side: cancelledLinkedOrder.side,
        type: cancelledLinkedOrder.type,
        quantity: cancelledLinkedOrder.quantity,
        status: 'cancelled',
        bracketRole: cancelledLinkedOrder.bracketRole,
        bracketGroupId: cancelledLinkedOrder.bracketGroupId,
      } satisfies OrderEventPayload);
    }

    if (pdtCount !== null && pdtCount === 2 && eventCuidUserId) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 7);
      this.eventEmitter.emit('pdt.warning', {
        cuidUserId: eventCuidUserId,
        dayTradeCount: pdtCount,
        windowStartDate: windowStart.toISOString().split('T')[0],
      } satisfies PdtWarningPayload);
    }
  }

  /**
   * Evaluate whether order conditions are met for limit/stop/stop_limit orders.
   * Returns the fill price if conditions are met, or null if not.
   */
  evaluateOrderConditions(
    type: OrderType,
    side: OrderSide,
    quote: Quote,
    limitPrice?: string | null,
    stopPrice?: string | null,
  ): Decimal | null {
    const ask = new Decimal(quote.askPrice);
    const bid = new Decimal(quote.bidPrice);

    switch (type) {
      case 'market':
        return side === 'buy' ? ask : bid;

      case 'limit': {
        const limit = new Decimal(limitPrice!);
        if (side === 'buy' && ask.lte(limit)) return ask;
        if (side === 'sell' && bid.gte(limit)) return bid;
        return null;
      }

      case 'stop': {
        const stop = new Decimal(stopPrice!);
        if (side === 'buy' && ask.gte(stop)) return ask;
        if (side === 'sell' && bid.lte(stop)) return bid;
        return null;
      }

      case 'stop_limit': {
        const stop = new Decimal(stopPrice!);
        const limit = new Decimal(limitPrice!);
        if (side === 'buy' && ask.gte(stop) && ask.lte(limit)) return ask;
        if (side === 'sell' && bid.lte(stop) && bid.gte(limit)) return bid;
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Get fill price for a market order.
   */
  getMarketFillPrice(side: OrderSide, quote: Quote): Decimal {
    return side === 'buy' ? new Decimal(quote.askPrice) : new Decimal(quote.bidPrice);
  }

  // ── Private Methods ──

  private async createBracketChildren(
    entryOrder: typeof orders.$inferSelect,
  ): Promise<{ takeProfitOrderId?: string; stopLossOrderId?: string }> {
    const oppositeSide = entryOrder.side === 'buy' ? 'sell' : 'buy';
    const result: { takeProfitOrderId?: string; stopLossOrderId?: string } = {};
    let tpOrderId: string | undefined;
    let slOrderId: string | undefined;

    if (entryOrder.takeProfitLimitPrice) {
      const [tpOrder] = await this.drizzle.db
        .insert(orders)
        .values({
          cuidUserId: entryOrder.cuidUserId,
          symbol: entryOrder.symbol,
          assetClass: entryOrder.assetClass,
          side: oppositeSide,
          type: 'limit',
          quantity: entryOrder.filledQuantity,
          limitPrice: entryOrder.takeProfitLimitPrice,
          timeInForce: 'gtc',
          parentOrderId: entryOrder.id,
          bracketGroupId: entryOrder.bracketGroupId,
          bracketRole: 'take_profit',
        })
        .returning();
      tpOrderId = tpOrder.id;
      result.takeProfitOrderId = tpOrder.id;
    }

    if (entryOrder.stopLossStopPrice) {
      const slType = entryOrder.stopLossLimitPrice ? 'stop_limit' : 'stop';
      const [slOrder] = await this.drizzle.db
        .insert(orders)
        .values({
          cuidUserId: entryOrder.cuidUserId,
          symbol: entryOrder.symbol,
          assetClass: entryOrder.assetClass,
          side: oppositeSide,
          type: slType,
          quantity: entryOrder.filledQuantity,
          stopPrice: entryOrder.stopLossStopPrice,
          limitPrice: entryOrder.stopLossLimitPrice ?? null,
          timeInForce: 'gtc',
          parentOrderId: entryOrder.id,
          bracketGroupId: entryOrder.bracketGroupId,
          bracketRole: 'stop_loss',
        })
        .returning();
      slOrderId = slOrder.id;
      result.stopLossOrderId = slOrder.id;
    }

    // Link TP ↔ SL as OCO pair
    if (tpOrderId && slOrderId) {
      await this.drizzle.db.update(orders).set({ linkedOrderId: slOrderId }).where(eq(orders.id, tpOrderId));
      await this.drizzle.db.update(orders).set({ linkedOrderId: tpOrderId }).where(eq(orders.id, slOrderId));
    }

    return result;
  }

  private async cancelOcoLinkedOrder(
    filledOrder: typeof orders.$inferSelect,
  ): Promise<typeof orders.$inferSelect | null> {
    if (!filledOrder.linkedOrderId) return null;

    const [linked] = await this.drizzle.db
      .select()
      .from(orders)
      .where(eq(orders.id, filledOrder.linkedOrderId))
      .limit(1);

    if (!linked || (linked.status !== 'pending' && linked.status !== 'partially_filled')) return null;

    await this.drizzle.db
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, linked.id));

    return linked;
  }

  private async updatePosition(
    tx: Tx,
    cuidUserId: string,
    symbol: string,
    side: 'buy' | 'sell',
    fillQuantity: Decimal,
    fillPrice: Decimal,
    existingPosition: typeof positions.$inferSelect | undefined,
  ): Promise<void> {
    const positionId = `${cuidUserId}:${symbol}`;
    const currentQty = existingPosition ? new Decimal(existingPosition.quantity) : new Decimal(0);

    let newQty: Decimal;
    let newAvgCostBasis: Decimal;
    let newTotalCostBasis: Decimal;

    if (side === 'buy') {
      newQty = currentQty.plus(fillQuantity);

      if (currentQty.lt(0)) {
        // Covering short
        if (newQty.isZero()) {
          // Full cover — delete position
          await tx.delete(positions).where(eq(positions.id, positionId));
          return;
        } else if (newQty.gt(0)) {
          // Flip short → long: new long with remainder
          newAvgCostBasis = fillPrice;
          newTotalCostBasis = fillPrice.mul(newQty);
        } else {
          // Partial cover — reduce short, keep avgCostBasis
          newAvgCostBasis = new Decimal(existingPosition!.avgCostBasis);
          newTotalCostBasis = newAvgCostBasis.mul(newQty.abs());
        }
      } else if (currentQty.isZero()) {
        // New long position
        newAvgCostBasis = fillPrice;
        newTotalCostBasis = fillPrice.mul(fillQuantity);
      } else {
        // Increase existing long — weighted average
        const existingCost = new Decimal(existingPosition!.totalCostBasis);
        const addedCost = fillPrice.mul(fillQuantity);
        newTotalCostBasis = existingCost.plus(addedCost);
        newAvgCostBasis = newTotalCostBasis.div(newQty);
      }
    } else {
      // Sell
      newQty = currentQty.minus(fillQuantity);

      if (currentQty.gt(0)) {
        // Selling long
        if (newQty.isZero()) {
          // Full close — delete position
          await tx.delete(positions).where(eq(positions.id, positionId));
          return;
        } else if (newQty.lt(0)) {
          // Flip long → short: new short with remainder
          newAvgCostBasis = fillPrice;
          newTotalCostBasis = fillPrice.mul(newQty.abs());
        } else {
          // Partial sell — reduce long, keep avgCostBasis
          newAvgCostBasis = new Decimal(existingPosition!.avgCostBasis);
          newTotalCostBasis = newAvgCostBasis.mul(newQty);
        }
      } else if (currentQty.isZero()) {
        // New short position (negative qty)
        newAvgCostBasis = fillPrice;
        newTotalCostBasis = fillPrice.mul(fillQuantity);
      } else {
        // Increase existing short
        const existingCost = new Decimal(existingPosition!.totalCostBasis);
        const addedCost = fillPrice.mul(fillQuantity);
        newTotalCostBasis = existingCost.plus(addedCost);
        newAvgCostBasis = newTotalCostBasis.div(newQty.abs());
      }
    }

    if (existingPosition) {
      await tx
        .update(positions)
        .set({
          quantity: newQty.toFixed(6),
          avgCostBasis: newAvgCostBasis?.toFixed(4),
          totalCostBasis: newTotalCostBasis?.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, positionId));
    } else {
      const parsed = isOptionSymbol(symbol) ? parseOptionSymbol(symbol) : null;
      await tx.insert(positions).values({
        id: positionId,
        cuidUserId,
        symbol,
        assetClass: isOptionSymbol(symbol) ? 'option' : isCryptoSymbol(symbol) ? 'crypto' : 'us_equity',
        quantity: newQty.toFixed(6),
        avgCostBasis: newAvgCostBasis?.toFixed(4),
        totalCostBasis: newTotalCostBasis?.toFixed(2),
        ...(parsed
          ? {
              optionType: parsed.type,
              strikePrice: parsed.strike,
              expiration: parsed.expiration,
              underlyingSymbol: parsed.underlying,
              multiplier: String(OPTIONS_MULTIPLIER),
            }
          : {}),
      });
    }
  }

  private async handleBorrows(
    tx: Tx,
    cuidUserId: string,
    symbol: string,
    side: 'buy' | 'sell',
    fillQuantity: Decimal,
    fillPrice: Decimal,
    currentPositionQty: Decimal,
    currentMarginUsed: Decimal,
  ): Promise<Decimal> {
    let marginUsed = currentMarginUsed;

    if (side === 'sell') {
      // Determine short quantity (new shares being shorted)
      let shortQty: Decimal;
      if (currentPositionQty.gt(0)) {
        // Had a long — only the excess beyond long is short
        shortQty = fillQuantity.minus(currentPositionQty);
        if (shortQty.lte(0)) return marginUsed; // pure long sell, no borrow
      } else {
        // Already short or no position — entire fill is short
        shortQty = fillQuantity;
      }

      // Look up borrow tier
      const { tier, rate } = await this.lookupBorrowTier(tx, symbol);

      if (tier === 'not_shortable') {
        throw new BadRequestException(`${symbol} is not shortable`);
      }

      // Insert borrow record
      await tx.insert(borrows).values({
        cuidUserId,
        symbol,
        quantity: shortQty.toFixed(6),
        entryPrice: fillPrice.toFixed(4),
        borrowRate: rate,
        borrowTier: tier,
      });

      // Reserve margin (50% of position value)
      const marginReserve = fillPrice.mul(shortQty).mul(INITIAL_MARGIN_REQUIREMENT);
      marginUsed = marginUsed.plus(marginReserve);
    } else if (side === 'buy' && currentPositionQty.lt(0)) {
      // Covering short — close borrows FIFO
      let remainingToCover = fillQuantity;

      const openBorrows = await tx
        .select()
        .from(borrows)
        .where(and(eq(borrows.cuidUserId, cuidUserId), eq(borrows.symbol, symbol), isNull(borrows.closedAt)))
        .orderBy(asc(borrows.openedAt));

      for (const borrow of openBorrows) {
        if (remainingToCover.lte(0)) break;

        const borrowQty = new Decimal(borrow.quantity);
        const closingQty = Decimal.min(remainingToCover, borrowQty);

        if (closingQty.gte(borrowQty)) {
          // Close entire borrow
          await tx.update(borrows).set({ closedAt: new Date() }).where(eq(borrows.id, borrow.id));
        } else {
          // Partial close: reduce borrow quantity and create closed record
          await tx
            .update(borrows)
            .set({
              quantity: borrowQty.minus(closingQty).toFixed(6),
            })
            .where(eq(borrows.id, borrow.id));
        }

        // Release margin
        const marginRelease = new Decimal(borrow.entryPrice).mul(closingQty).mul(INITIAL_MARGIN_REQUIREMENT);
        marginUsed = marginUsed.minus(marginRelease);

        remainingToCover = remainingToCover.minus(closingQty);
      }

      // Ensure margin doesn't go negative
      if (marginUsed.lt(0)) marginUsed = new Decimal(0);
    }

    return marginUsed;
  }

  private async lookupBorrowTier(
    tx: Tx,
    symbol: string,
  ): Promise<{ tier: 'easy' | 'moderate' | 'hard' | 'not_shortable'; rate: string }> {
    // Check borrowFeeTiers table first
    const [tierRecord] = await tx
      .select()
      .from(borrowFeeTiers)
      .where(eq(borrowFeeTiers.symbol, symbol.toUpperCase()))
      .limit(1);

    if (tierRecord) {
      return { tier: tierRecord.tier, rate: tierRecord.annualRate };
    }

    // Fallback: use market data provider asset flags
    try {
      const asset = await this.marketDataService.getAssets();
      const assetRecord = asset.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());

      if (!assetRecord || !assetRecord.shortable) {
        return { tier: 'not_shortable', rate: '0.0000' };
      }
      if (assetRecord.easyToBorrow) {
        return { tier: 'easy', rate: BORROW_RATE_EASY };
      }
      return { tier: 'moderate', rate: BORROW_RATE_MODERATE };
    } catch {
      // If we can't look up the asset, default to moderate
      return { tier: 'moderate', rate: BORROW_RATE_MODERATE };
    }
  }
}
