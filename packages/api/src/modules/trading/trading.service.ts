import { randomUUID } from 'node:crypto';
import {
  CRYPTO_ALLOWED_ORDER_TYPES,
  CRYPTO_ALLOWED_TIF,
  INITIAL_MARGIN_REQUIREMENT,
  isCryptoSymbol,
  isOptionSymbol,
  normalizeCryptoSymbol,
  OPTIONS_ALLOWED_ORDER_TYPES,
  OPTIONS_ALLOWED_TIF,
  OPTIONS_MULTIPLIER,
  parseOptionSymbol,
} from '@algoarena/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { and, desc, eq } from 'drizzle-orm';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { DrizzleProvider } from '../database/drizzle.provider';
import { borrowFeeTiers, cuidUsers, fills, orders, positions } from '../database/schema';
import { MarketDataProvider } from '../market-data/market-data.provider';
import { MarketDataService } from '../market-data/market-data.service';
import { Asset, Quote } from '../market-data/types/market-data-provider.types';
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
    // 0a. Multi-leg dispatch
    if (dto.orderClass === 'multileg' && dto.legs) {
      return this.placeMultiLegOrder(cuidUserId, dto);
    }

    // 0b. Asset class detection + normalization
    const isOption = isOptionSymbol(dto.symbol);
    const isCrypto = !isOption && isCryptoSymbol(dto.symbol);
    if (isCrypto) dto.symbol = normalizeCryptoSymbol(dto.symbol);
    if (isOption) dto.symbol = dto.symbol.toUpperCase();

    // 1. Validate DTO
    this.validateOrderDto(dto);

    // 2. Asset-specific constraints
    if (isCrypto) this.validateCryptoConstraints(dto);
    if (isOption) this.validateOptionsConstraints(dto);

    // 3. Validate symbol
    let asset: Asset | null = null;
    if (!isOption) {
      asset = await this.marketDataProvider.getAsset(dto.symbol);
      if (!asset.tradable) {
        throw new BadRequestException(`${dto.symbol} is not tradable`);
      }
    } else {
      // Validate OCC format for options
      const parsed = parseOptionSymbol(dto.symbol);
      if (!parsed) {
        throw new BadRequestException(`Invalid OCC option symbol: ${dto.symbol}`);
      }
    }

    // 3b. Get quote + clock
    let quote: Quote;
    if (isOption) {
      const optionQuotes = await this.marketDataService.getOptionQuotes([dto.symbol]);
      const optionQuote = optionQuotes[dto.symbol];
      if (!optionQuote) {
        throw new BadRequestException(`No option quote found for ${dto.symbol}`);
      }
      quote = {
        timestamp: new Date().toISOString(),
        askPrice: parseFloat(optionQuote.ask),
        askSize: 0,
        bidPrice: parseFloat(optionQuote.bid),
        bidSize: 0,
      };
    } else {
      quote = await this.marketDataService.getQuote(dto.symbol);
    }
    const clock = await this.marketDataService.getClock();

    // 4. Load fresh user + existing position
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, cuidUserId)).limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedSymbol = isCrypto ? dto.symbol : dto.symbol.toUpperCase();
    const effectiveMultiplier = isOption ? OPTIONS_MULTIPLIER : 1;
    const positionId = `${cuidUserId}:${normalizedSymbol}`;
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
    if (dto.type === 'trailing_stop' && isShortSell) {
      throw new BadRequestException('Trailing stop orders require an existing long position');
    }

    if (isShortSell) {
      if (isOption) {
        throw new BadRequestException('Short selling is not supported for options');
      }
      if (isCrypto) {
        throw new BadRequestException('Short selling is not supported for crypto');
      }

      if (!asset!.shortable) {
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
      if (!tierRecord && !asset!.shortable) {
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

    // 7. PDT check (equities only — skip for crypto and options)
    if (user.pdtEnforced && !isCrypto && !isOption) {
      const equity = await this.computeEquity(user);
      const pdtError = await this.pdtService.checkPdtRule(cuidUserId, equity);
      if (pdtError) {
        throw new BadRequestException(pdtError);
      }
    }

    // 8. Buying power check (multiplier-aware for options)
    const askPrice = new Decimal(quote.askPrice);
    const _bidPrice = new Decimal(quote.bidPrice);
    const cash = new Decimal(user.cashBalance);
    const multipliedCost = askPrice.mul(fillQuantity).mul(effectiveMultiplier);

    if (dto.side === 'buy') {
      if (isCover) {
        if (cash.lt(multipliedCost)) {
          throw new BadRequestException(
            `Insufficient funds to cover: need $${multipliedCost.toFixed(2)}, have $${cash.toFixed(2)}`,
          );
        }
      } else {
        if (cash.lt(multipliedCost)) {
          throw new BadRequestException(
            `Insufficient funds: need $${multipliedCost.toFixed(2)}, have $${cash.toFixed(2)}`,
          );
        }
      }
    } else if (!isShortSell) {
      // Sell long: must have sufficient position
      if (currentPositionQty.lt(fillQuantity)) {
        const unit = isOption ? 'contracts' : 'shares';
        throw new BadRequestException(
          `Insufficient position: have ${currentPositionQty.toFixed(isOption ? 0 : 6)} ${unit}, trying to sell ${fillQuantity.toFixed(isOption ? 0 : 6)}`,
        );
      }
    }

    // 9. Insert order
    const [order] = await this.drizzle.db
      .insert(orders)
      .values({
        cuidUserId,
        symbol: normalizedSymbol,
        assetClass: isOption ? 'option' : isCrypto ? 'crypto' : 'us_equity',
        side: dto.side,
        type: dto.type,
        timeInForce: dto.timeInForce,
        quantity: dto.quantity,
        limitPrice: dto.limitPrice ?? null,
        stopPrice: dto.stopPrice ?? null,
        trailPercent: dto.trailPercent ?? null,
        trailPrice: dto.trailPrice ?? null,
        ...(dto.bracket
          ? {
              bracketGroupId: randomUUID(),
              bracketRole: 'entry',
              takeProfitLimitPrice: dto.bracket.takeProfit?.limitPrice ?? null,
              stopLossStopPrice: dto.bracket.stopLoss?.stopPrice ?? null,
              stopLossLimitPrice: dto.bracket.stopLoss?.limitPrice ?? null,
            }
          : {}),
      })
      .returning();

    // 9b. OCO linking
    if (dto.ocoLinkedTo) {
      const [linkedOrder] = await this.drizzle.db
        .select()
        .from(orders)
        .where(and(eq(orders.id, dto.ocoLinkedTo), eq(orders.cuidUserId, cuidUserId)))
        .limit(1);

      if (!linkedOrder) throw new NotFoundException('Linked OCO order not found');
      if (linkedOrder.status !== 'pending' && linkedOrder.status !== 'partially_filled') {
        throw new BadRequestException('Linked OCO order must be pending or partially_filled');
      }
      if (linkedOrder.symbol !== normalizedSymbol) {
        throw new BadRequestException('OCO linked orders must be for the same symbol');
      }
      if (linkedOrder.linkedOrderId) {
        throw new BadRequestException('Target order is already linked to another OCO order');
      }

      // Bidirectional link
      await this.drizzle.db.update(orders).set({ linkedOrderId: order.id }).where(eq(orders.id, linkedOrder.id));
      await this.drizzle.db.update(orders).set({ linkedOrderId: linkedOrder.id }).where(eq(orders.id, order.id));
    }

    // 9c. Compute HWM for trailing stops
    if (dto.type === 'trailing_stop') {
      const bidPrice = new Decimal(quote.bidPrice);
      const hwm = bidPrice;
      let stopPriceCalc: Decimal;
      if (dto.trailPercent) {
        stopPriceCalc = hwm.mul(new Decimal(1).minus(new Decimal(dto.trailPercent).div(100)));
      } else {
        stopPriceCalc = hwm.minus(new Decimal(dto.trailPrice!));
      }
      await this.drizzle.db
        .update(orders)
        .set({
          highWaterMark: hwm.toFixed(4),
          trailingStopPrice: stopPriceCalc.toFixed(4),
        })
        .where(eq(orders.id, order.id));
    }

    // 10. Immediate fill logic
    try {
      if (dto.type === 'market') {
        if (clock.isOpen || isCrypto) {
          const fillPrice = this.orderEngine.getMarketFillPrice(dto.side, quote);
          await this.orderEngine.executeFill({
            orderId: order.id,
            fillPrice,
            fillQuantity,
            multiplier: effectiveMultiplier,
          });
        } else if (dto.timeInForce === 'ioc' || dto.timeInForce === 'fok') {
          // IOC/FOK + market closed → reject
          await this.rejectOrder(order.id, 'Market is closed');
          this.emitOrderRejected(order, cuidUserId, 'Market is closed');
        }
        // else: day/gtc market order stays pending until market opens
      } else if (dto.timeInForce === 'ioc' || dto.timeInForce === 'fok') {
        if (!clock.isOpen && !isCrypto) {
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
              multiplier: effectiveMultiplier,
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

  async placeMultiLegOrder(cuidUserId: string, dto: PlaceOrderDto) {
    const legs = dto.legs!;

    // 1. Validate leg count
    if (legs.length < 2 || legs.length > 4) {
      throw new BadRequestException('Multi-leg orders must have 2-4 legs');
    }

    // 2. Validate all legs are valid OCC symbols with same underlying and expiration
    const parsedLegs = legs.map((leg) => {
      const parsed = parseOptionSymbol(leg.symbol);
      if (!parsed) {
        throw new BadRequestException(`Invalid OCC option symbol: ${leg.symbol}`);
      }
      return { ...leg, symbol: leg.symbol.toUpperCase(), parsed };
    });

    const underlying = parsedLegs[0].parsed.underlying;
    const expiration = parsedLegs[0].parsed.expiration;

    for (const leg of parsedLegs) {
      if (leg.parsed.underlying !== underlying) {
        throw new BadRequestException('All legs must share the same underlying symbol');
      }
      if (leg.parsed.expiration !== expiration) {
        throw new BadRequestException('All legs must share the same expiration date');
      }
      const qty = new Decimal(leg.quantity);
      if (!qty.isInteger() || qty.lte(0)) {
        throw new BadRequestException('All leg quantities must be positive whole numbers');
      }
    }

    // 3. Validate no bracket or OCO
    if (dto.bracket) {
      throw new BadRequestException('Bracket orders cannot be combined with multi-leg orders');
    }
    if (dto.ocoLinkedTo) {
      throw new BadRequestException('OCO linking cannot be combined with multi-leg orders');
    }

    // 4. Fetch option quotes for all leg symbols
    const legSymbols = parsedLegs.map((l) => l.symbol);
    const optionQuotes = await this.marketDataService.getOptionQuotes(legSymbols);

    for (const leg of parsedLegs) {
      if (!optionQuotes[leg.symbol]) {
        throw new BadRequestException(`No option quote found for ${leg.symbol}`);
      }
    }

    // 5. Calculate net premium
    let netPremium = new Decimal(0);
    for (const leg of parsedLegs) {
      const oq = optionQuotes[leg.symbol];
      const qty = new Decimal(leg.quantity);
      if (leg.side === 'buy') {
        netPremium = netPremium.plus(new Decimal(oq.ask).mul(qty).mul(OPTIONS_MULTIPLIER));
      } else {
        netPremium = netPremium.minus(new Decimal(oq.bid).mul(qty).mul(OPTIONS_MULTIPLIER));
      }
    }

    // 6. For limit orders, check net premium against limit price
    if (dto.type === 'limit' && dto.limitPrice) {
      const limitNet = new Decimal(dto.limitPrice).mul(OPTIONS_MULTIPLIER);
      if (netPremium.gt(0) && netPremium.gt(limitNet)) {
        // Debit spread: net cost exceeds limit
        // Don't fill yet — leave as pending for price monitor
      }
    }

    // 7. Buying power check: need cash for net debit
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, cuidUserId)).limit(1);
    if (!user) throw new NotFoundException('User not found');

    const cash = new Decimal(user.cashBalance);
    if (netPremium.gt(0) && cash.lt(netPremium)) {
      throw new BadRequestException(
        `Insufficient funds for multi-leg order: need $${netPremium.toFixed(2)}, have $${cash.toFixed(2)}`,
      );
    }

    // 8. Insert orders atomically with shared legGroupId
    const legGroupId = randomUUID();
    const clock = await this.marketDataService.getClock();
    const createdOrders: Array<typeof orders.$inferSelect> = [];

    for (const leg of parsedLegs) {
      const [order] = await this.drizzle.db
        .insert(orders)
        .values({
          cuidUserId,
          symbol: leg.symbol,
          assetClass: 'option',
          side: leg.side,
          type: leg.type as 'market' | 'limit',
          timeInForce: dto.timeInForce,
          quantity: leg.quantity,
          limitPrice: dto.limitPrice ?? null,
          orderClass: 'multileg',
          legGroupId,
        })
        .returning();
      createdOrders.push(order);
    }

    // 9. For market orders, fill all legs immediately if market is open
    if (dto.type === 'market' && clock.isOpen) {
      for (let i = 0; i < parsedLegs.length; i++) {
        const leg = parsedLegs[i];
        const order = createdOrders[i];
        const oq = optionQuotes[leg.symbol];
        const fillPrice = leg.side === 'buy' ? new Decimal(oq.ask) : new Decimal(oq.bid);
        const fillQuantity = new Decimal(leg.quantity);

        await this.orderEngine.executeFill({
          orderId: order.id,
          fillPrice,
          fillQuantity,
          multiplier: OPTIONS_MULTIPLIER,
        });
      }
    }

    // 10. Return leg group with all child orders
    const finalOrders = await Promise.all(createdOrders.map((o) => this.getOrderById(o.id, cuidUserId)));

    return {
      legGroupId,
      orderClass: 'multileg',
      legs: finalOrders,
    };
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

  private validateOptionsConstraints(dto: PlaceOrderDto): void {
    if (!(OPTIONS_ALLOWED_ORDER_TYPES as readonly string[]).includes(dto.type)) {
      throw new BadRequestException(
        `Order type '${dto.type}' not supported for options. Allowed: ${OPTIONS_ALLOWED_ORDER_TYPES.join(', ')}`,
      );
    }
    if (!(OPTIONS_ALLOWED_TIF as readonly string[]).includes(dto.timeInForce)) {
      throw new BadRequestException(
        `Time in force '${dto.timeInForce}' not supported for options. Allowed: ${OPTIONS_ALLOWED_TIF.join(', ')}`,
      );
    }
    const qty = new Decimal(dto.quantity);
    if (!qty.isInteger()) {
      throw new BadRequestException('Options quantity must be a whole number (no fractional contracts)');
    }
    if (dto.trailPercent || dto.trailPrice) {
      throw new BadRequestException('Trailing stop parameters not supported for options');
    }
    if (dto.bracket) {
      throw new BadRequestException('Bracket orders are not supported for options');
    }
  }

  private validateCryptoConstraints(dto: PlaceOrderDto): void {
    if (!(CRYPTO_ALLOWED_ORDER_TYPES as readonly string[]).includes(dto.type)) {
      throw new BadRequestException(
        `Order type '${dto.type}' is not supported for crypto. Allowed: ${CRYPTO_ALLOWED_ORDER_TYPES.join(', ')}`,
      );
    }
    if (!(CRYPTO_ALLOWED_TIF as readonly string[]).includes(dto.timeInForce)) {
      throw new BadRequestException(
        `Time in force '${dto.timeInForce}' is not supported for crypto. Allowed: ${CRYPTO_ALLOWED_TIF.join(', ')}`,
      );
    }
    if (dto.bracket?.stopLoss && !dto.bracket.stopLoss.limitPrice) {
      throw new BadRequestException(
        'Crypto bracket stopLoss requires limitPrice (stop_limit). Bare stop is not supported for crypto.',
      );
    }
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

    if (dto.type === 'trailing_stop') {
      if (dto.side !== 'sell') {
        throw new BadRequestException('Trailing stop orders must be sell-side');
      }
      if (dto.limitPrice) {
        throw new BadRequestException('limitPrice must not be set for trailing_stop orders');
      }
      if (dto.stopPrice) {
        throw new BadRequestException('stopPrice must not be set for trailing_stop orders');
      }
      if (!dto.trailPercent && !dto.trailPrice) {
        throw new BadRequestException('trailing_stop requires either trailPercent or trailPrice');
      }
      if (dto.trailPercent && dto.trailPrice) {
        throw new BadRequestException('Set only one of trailPercent or trailPrice, not both');
      }
      if (dto.trailPercent) {
        const tp = new Decimal(dto.trailPercent);
        if (tp.lte(0) || tp.gt(50)) {
          throw new BadRequestException('trailPercent must be > 0 and <= 50');
        }
      }
      if (dto.trailPrice) {
        const tp = new Decimal(dto.trailPrice);
        if (tp.lte(0)) {
          throw new BadRequestException('trailPrice must be > 0');
        }
      }
      if (dto.timeInForce !== 'day' && dto.timeInForce !== 'gtc') {
        throw new BadRequestException('Trailing stop orders only support day or gtc time-in-force');
      }
    }

    if (dto.type !== 'trailing_stop') {
      if (dto.trailPercent) throw new BadRequestException('trailPercent is only valid for trailing_stop orders');
      if (dto.trailPrice) throw new BadRequestException('trailPrice is only valid for trailing_stop orders');
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

    // Bracket validation
    if (dto.bracket) {
      if (dto.type === 'trailing_stop') {
        throw new BadRequestException('bracket cannot be combined with trailing_stop orders');
      }
      if (!dto.bracket.takeProfit && !dto.bracket.stopLoss) {
        throw new BadRequestException('bracket must include at least takeProfit or stopLoss');
      }
      if (dto.bracket.takeProfit) {
        const tp = new Decimal(dto.bracket.takeProfit.limitPrice);
        if (tp.lte(0)) throw new BadRequestException('bracket.takeProfit.limitPrice must be > 0');
      }
      if (dto.bracket.stopLoss) {
        const sl = new Decimal(dto.bracket.stopLoss.stopPrice);
        if (sl.lte(0)) throw new BadRequestException('bracket.stopLoss.stopPrice must be > 0');
        if (dto.bracket.stopLoss.limitPrice) {
          const slLimit = new Decimal(dto.bracket.stopLoss.limitPrice);
          if (slLimit.lte(0)) throw new BadRequestException('bracket.stopLoss.limitPrice must be > 0');
        }
      }
      if (dto.bracket.takeProfit && dto.bracket.stopLoss) {
        const tp = new Decimal(dto.bracket.takeProfit.limitPrice);
        const sl = new Decimal(dto.bracket.stopLoss.stopPrice);
        if (dto.side === 'buy' && tp.lte(sl)) {
          throw new BadRequestException('For buy bracket: takeProfit.limitPrice must be > stopLoss.stopPrice');
        }
        if (dto.side === 'sell' && tp.gte(sl)) {
          throw new BadRequestException('For sell bracket: takeProfit.limitPrice must be < stopLoss.stopPrice');
        }
      }
    }

    if (dto.ocoLinkedTo && dto.bracket) {
      throw new BadRequestException('Cannot combine bracket and ocoLinkedTo');
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

    if (!order) return null;

    // If bracket entry, include child order IDs
    if (order.bracketRole === 'entry' && order.bracketGroupId) {
      const children = await this.drizzle.db
        .select({ id: orders.id, bracketRole: orders.bracketRole })
        .from(orders)
        .where(eq(orders.parentOrderId, order.id));

      const bracket: { takeProfitOrderId?: string; stopLossOrderId?: string } = {};
      for (const child of children) {
        if (child.bracketRole === 'take_profit') bracket.takeProfitOrderId = child.id;
        if (child.bracketRole === 'stop_loss') bracket.stopLossOrderId = child.id;
      }

      return { ...order, bracket: children.length > 0 ? bracket : undefined };
    }

    return order;
  }
}
