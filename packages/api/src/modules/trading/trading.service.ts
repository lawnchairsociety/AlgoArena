import { INITIAL_MARGIN_REQUIREMENT } from '@algoarena/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { and, desc, eq } from 'drizzle-orm';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { DrizzleProvider } from '../database/drizzle.provider';
import { borrowFeeTiers, cuidUsers, fills, orders, positions } from '../database/schema';
import { MarketDataProvider } from '../market-data/market-data.provider';
import { MarketDataService } from '../market-data/market-data.service';
import { OrderEventPayload } from '../websocket/ws-event.types';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { OrderEngineService } from './order-engine.service';
import { PdtService } from './pdt.service';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly marketDataProvider: MarketDataProvider,
    private readonly orderEngine: OrderEngineService,
    private readonly pdtService: PdtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Public Methods ──

  async placeOrder(cuidUserId: string, dto: PlaceOrderDto) {
    // 1. Validate DTO
    this.validateOrderDto(dto);

    // 2. Validate symbol
    const asset = await this.marketDataProvider.getAsset(dto.symbol);
    if (!asset.tradable) {
      throw new BadRequestException(`${dto.symbol} is not tradable`);
    }

    // 3. Get quote + clock
    const [quote, clock] = await Promise.all([
      this.marketDataService.getQuote(dto.symbol),
      this.marketDataService.getClock(),
    ]);

    // 4. Load fresh user + existing position
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, cuidUserId)).limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const positionId = `${cuidUserId}:${dto.symbol.toUpperCase()}`;
    const [existingPosition] = await this.drizzle.db
      .select()
      .from(positions)
      .where(eq(positions.id, positionId))
      .limit(1);

    const currentPositionQty = existingPosition ? new Decimal(existingPosition.quantity) : new Decimal(0);
    const fillQuantity = new Decimal(dto.quantity);

    // 5. Determine intent
    const isShortSell = dto.side === 'sell' && (currentPositionQty.lte(0) || fillQuantity.gt(currentPositionQty));
    const isCover = dto.side === 'buy' && currentPositionQty.lt(0);

    // 6. Short sell checks
    if (isShortSell) {
      if (!asset.shortable) {
        throw new BadRequestException(`${dto.symbol} is not shortable`);
      }

      // Check borrow fee tier
      const [tierRecord] = await this.drizzle.db
        .select()
        .from(borrowFeeTiers)
        .where(eq(borrowFeeTiers.symbol, dto.symbol.toUpperCase()))
        .limit(1);

      if (tierRecord && tierRecord.tier === 'not_shortable') {
        throw new BadRequestException(`${dto.symbol} is not shortable (borrow tier)`);
      }
      if (!tierRecord && !asset.shortable) {
        throw new BadRequestException(`${dto.symbol} is not shortable`);
      }

      // SSR check → DEFERRED (TODO: implement SSR check)

      // Margin check
      const shortQty = currentPositionQty.gt(0) ? fillQuantity.minus(currentPositionQty) : fillQuantity;
      const estimatedFillPrice = new Decimal(quote.askPrice);
      const marginRequired = estimatedFillPrice.mul(shortQty).mul(INITIAL_MARGIN_REQUIREMENT);
      const cash = new Decimal(user.cashBalance);
      const marginUsed = new Decimal(user.marginUsed);
      const availableMargin = cash.minus(marginUsed);

      if (availableMargin.lt(marginRequired)) {
        throw new BadRequestException(
          `Insufficient margin for short sell: need $${marginRequired.toFixed(2)}, available $${availableMargin.toFixed(2)}`,
        );
      }
    }

    // 7. PDT check
    if (user.pdtEnforced) {
      const equity = await this.computeEquity(user);
      const pdtError = await this.pdtService.checkPdtRule(cuidUserId, equity);
      if (pdtError) {
        throw new BadRequestException(pdtError);
      }
    }

    // 8. Buying power check
    const askPrice = new Decimal(quote.askPrice);
    const _bidPrice = new Decimal(quote.bidPrice);
    const cash = new Decimal(user.cashBalance);

    if (dto.side === 'buy') {
      if (isCover) {
        // Buy to cover: need cash
        if (cash.lt(askPrice.mul(fillQuantity))) {
          throw new BadRequestException(
            `Insufficient funds to cover: need $${askPrice.mul(fillQuantity).toFixed(2)}, have $${cash.toFixed(2)}`,
          );
        }
      } else {
        // Buy long
        if (cash.lt(askPrice.mul(fillQuantity))) {
          throw new BadRequestException(
            `Insufficient funds: need $${askPrice.mul(fillQuantity).toFixed(2)}, have $${cash.toFixed(2)}`,
          );
        }
      }
    } else if (!isShortSell) {
      // Sell long: must have sufficient position
      if (currentPositionQty.lt(fillQuantity)) {
        throw new BadRequestException(
          `Insufficient position: have ${currentPositionQty.toFixed(6)} shares, trying to sell ${fillQuantity.toFixed(6)}`,
        );
      }
    }

    // 9. Insert order
    const [order] = await this.drizzle.db
      .insert(orders)
      .values({
        cuidUserId,
        symbol: dto.symbol.toUpperCase(),
        side: dto.side,
        type: dto.type,
        timeInForce: dto.timeInForce,
        quantity: dto.quantity,
        limitPrice: dto.limitPrice ?? null,
        stopPrice: dto.stopPrice ?? null,
      })
      .returning();

    // 10. Immediate fill logic
    try {
      if (dto.type === 'market') {
        if (clock.isOpen) {
          const fillPrice = this.orderEngine.getMarketFillPrice(dto.side, quote);
          await this.orderEngine.executeFill({
            orderId: order.id,
            fillPrice,
            fillQuantity,
          });
        } else if (dto.timeInForce === 'ioc' || dto.timeInForce === 'fok') {
          // IOC/FOK + market closed → reject
          await this.rejectOrder(order.id, 'Market is closed');
          this.emitOrderRejected(order, cuidUserId, 'Market is closed');
        }
        // else: day/gtc market order stays pending until market opens
      } else if (dto.timeInForce === 'ioc' || dto.timeInForce === 'fok') {
        if (!clock.isOpen) {
          await this.rejectOrder(order.id, 'Market is closed');
          this.emitOrderRejected(order, cuidUserId, 'Market is closed');
        } else {
          // Evaluate conditions
          const fillPrice = this.orderEngine.evaluateOrderConditions(
            dto.type,
            dto.side,
            quote,
            dto.limitPrice,
            dto.stopPrice,
          );

          if (fillPrice) {
            await this.orderEngine.executeFill({
              orderId: order.id,
              fillPrice,
              fillQuantity,
            });
          } else if (dto.timeInForce === 'fok') {
            // FOK: conditions not met → reject
            await this.rejectOrder(order.id, 'Fill-or-kill conditions not met');
            this.emitOrderRejected(order, cuidUserId, 'Fill-or-kill conditions not met');
          } else {
            // IOC: conditions not met → cancel
            await this.cancelOrderById(order.id);
            this.eventEmitter.emit('order.cancelled', {
              cuidUserId,
              orderId: order.id,
              symbol: order.symbol,
              side: order.side,
              type: order.type,
              quantity: order.quantity,
              status: 'cancelled',
            } satisfies OrderEventPayload);
          }
        }
      }
      // limit/stop/stop_limit with day/gtc → stays pending (PriceMonitorService evaluates later)
    } catch (error) {
      // If fill fails, reject the order
      const rejectionReason = error instanceof BadRequestException ? error.message : 'Internal error during fill';

      if (!(error instanceof BadRequestException)) {
        this.logger.error(`Fill failed for order ${order.id}`, error);
      }

      await this.rejectOrder(order.id, rejectionReason);

      this.eventEmitter.emit('order.rejected', {
        cuidUserId,
        orderId: order.id,
        symbol: order.symbol.toUpperCase(),
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        status: 'rejected',
        rejectionReason,
      } satisfies OrderEventPayload);
    }

    // Return the latest order state
    return this.getOrderById(order.id, cuidUserId);
  }

  async cancelOrder(orderId: string, cuidUserId: string) {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cuidUserId, cuidUserId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'pending' && order.status !== 'partially_filled') {
      throw new BadRequestException(`Cannot cancel order with status '${order.status}'`);
    }

    await this.cancelOrderById(orderId);

    this.eventEmitter.emit('order.cancelled', {
      cuidUserId,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      status: 'cancelled',
    } satisfies OrderEventPayload);

    return this.getOrderById(orderId, cuidUserId);
  }

  async listOrders(cuidUserId: string, query: ListOrdersQueryDto) {
    const conditions = [eq(orders.cuidUserId, cuidUserId)];

    if (query.status) {
      conditions.push(eq(orders.status, query.status));
    }
    if (query.symbol) {
      conditions.push(eq(orders.symbol, query.symbol.toUpperCase()));
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return this.drizzle.db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getOrder(orderId: string, cuidUserId: string) {
    const order = await this.getOrderById(orderId, cuidUserId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Include fills
    const orderFills = await this.drizzle.db.select().from(fills).where(eq(fills.orderId, orderId));

    return { ...order, fills: orderFills };
  }

  // ── Private Methods ──

  private async computeEquity(user: CuidUserRecord): Promise<Decimal> {
    const cash = new Decimal(user.cashBalance);

    // Get all positions for the user
    const userPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, user.id));

    if (userPositions.length === 0) {
      return cash;
    }

    // Get quotes for all position symbols
    const symbols = userPositions.map((p) => p.symbol);
    const quotes = await this.marketDataService.getQuotes(symbols);

    let positionsValue = new Decimal(0);
    for (const pos of userPositions) {
      const qty = new Decimal(pos.quantity);
      const quote = quotes[pos.symbol];
      if (quote) {
        // For longs use bid, for shorts use ask
        const price = qty.gt(0) ? new Decimal(quote.bidPrice) : new Decimal(quote.askPrice);
        positionsValue = positionsValue.plus(qty.mul(price));
      }
    }

    return cash.plus(positionsValue);
  }

  private validateOrderDto(dto: PlaceOrderDto): void {
    const qty = new Decimal(dto.quantity);
    if (qty.lte(0)) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    if ((dto.type === 'limit' || dto.type === 'stop_limit') && !dto.limitPrice) {
      throw new BadRequestException(`limitPrice is required for ${dto.type} orders`);
    }

    if ((dto.type === 'stop' || dto.type === 'stop_limit') && !dto.stopPrice) {
      throw new BadRequestException(`stopPrice is required for ${dto.type} orders`);
    }

    if (dto.type === 'market') {
      if (dto.limitPrice) {
        throw new BadRequestException('limitPrice must not be set for market orders');
      }
      if (dto.stopPrice) {
        throw new BadRequestException('stopPrice must not be set for market orders');
      }
    }

    if (dto.limitPrice) {
      const lp = new Decimal(dto.limitPrice);
      if (lp.lte(0)) {
        throw new BadRequestException('limitPrice must be greater than 0');
      }
    }

    if (dto.stopPrice) {
      const sp = new Decimal(dto.stopPrice);
      if (sp.lte(0)) {
        throw new BadRequestException('stopPrice must be greater than 0');
      }
    }
  }

  private async rejectOrder(orderId: string, reason: string): Promise<void> {
    await this.drizzle.db
      .update(orders)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  private async cancelOrderById(orderId: string): Promise<void> {
    await this.drizzle.db
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  private emitOrderRejected(
    order: { id: string; symbol: string; side: string; type: string; quantity: string },
    cuidUserId: string,
    reason: string,
  ): void {
    this.eventEmitter.emit('order.rejected', {
      cuidUserId,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      status: 'rejected',
      rejectionReason: reason,
    } satisfies OrderEventPayload);
  }

  private async getOrderById(orderId: string, cuidUserId: string) {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cuidUserId, cuidUserId)))
      .limit(1);

    return order ?? null;
  }
}
