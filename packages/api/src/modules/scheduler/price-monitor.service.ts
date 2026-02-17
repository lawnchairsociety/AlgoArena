import { isCryptoSymbol, isOptionSymbol, OPTIONS_MULTIPLIER, OrderSide, OrderType } from '@algoarena/shared';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';
import { DrizzleProvider } from '../database/drizzle.provider';
import { orders } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { Quote } from '../market-data/types/market-data-provider.types';
import { OrderEngineService } from '../trading/order-engine.service';

@Injectable()
export class PriceMonitorService {
  private readonly logger = new Logger(PriceMonitorService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly orderEngine: OrderEngineService,
  ) {}

  async evaluatePendingOrders(marketIsOpen = true): Promise<void> {
    const pendingOrders = await this.drizzle.db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['pending', 'partially_filled']),
          inArray(orders.type, ['limit', 'stop', 'stop_limit', 'trailing_stop']),
        ),
      );

    if (pendingOrders.length === 0) return;

    // Filter: always evaluate crypto, equity + options only when market is open
    const ordersToEvaluate = pendingOrders.filter((o) => {
      if (isCryptoSymbol(o.symbol)) return true;
      return marketIsOpen; // equity and options both follow equity hours
    });

    if (ordersToEvaluate.length === 0) return;

    // Partition option orders from equity/crypto
    const optionOrders = ordersToEvaluate.filter((o) => isOptionSymbol(o.symbol));
    const nonOptionOrders = ordersToEvaluate.filter((o) => !isOptionSymbol(o.symbol));

    let evaluated = 0;
    let filled = 0;

    // Evaluate non-option orders with equity/crypto quotes
    if (nonOptionOrders.length > 0) {
      const symbols = [...new Set(nonOptionOrders.map((o) => o.symbol))];
      const quotes = await this.marketDataService.getQuotes(symbols);

      for (const order of nonOptionOrders) {
        try {
          const quote = quotes[order.symbol];
          if (!quote) continue;

          if (order.type === 'trailing_stop') {
            await this.evaluateTrailingStop(order, quote);
            evaluated++;
            continue;
          }

          const fillPrice = this.orderEngine.evaluateOrderConditions(
            order.type as OrderType,
            order.side as OrderSide,
            quote,
            order.limitPrice,
            order.stopPrice,
          );

          evaluated++;

          if (fillPrice) {
            const fillQuantity = new Decimal(order.quantity).minus(new Decimal(order.filledQuantity));

            await this.orderEngine.executeFill({
              orderId: order.id,
              fillPrice,
              fillQuantity,
            });

            filled++;
            this.logger.log(`Filled ${order.type} order ${order.id} for ${order.symbol} @ ${fillPrice.toFixed(4)}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof BadRequestException) {
            await this.rejectOrder(order.id, message);
          } else {
            this.logger.error(`Error evaluating order ${order.id}: ${message}`);
          }
        }
      }
    }

    // Evaluate option orders with option quotes
    if (optionOrders.length > 0) {
      const optionSymbols = [...new Set(optionOrders.map((o) => o.symbol))];
      const optionQuotes = await this.marketDataService.getOptionQuotes(optionSymbols);

      for (const order of optionOrders) {
        try {
          const oq = optionQuotes[order.symbol];
          if (!oq) continue;

          const quote: Quote = {
            timestamp: new Date().toISOString(),
            askPrice: parseFloat(oq.ask),
            askSize: 0,
            bidPrice: parseFloat(oq.bid),
            bidSize: 0,
          };

          const fillPrice = this.orderEngine.evaluateOrderConditions(
            order.type as OrderType,
            order.side as OrderSide,
            quote,
            order.limitPrice,
            order.stopPrice,
          );

          evaluated++;

          if (fillPrice) {
            const fillQuantity = new Decimal(order.quantity).minus(new Decimal(order.filledQuantity));

            await this.orderEngine.executeFill({
              orderId: order.id,
              fillPrice,
              fillQuantity,
              multiplier: OPTIONS_MULTIPLIER,
            });

            filled++;
            this.logger.log(
              `Filled option ${order.type} order ${order.id} for ${order.symbol} @ ${fillPrice.toFixed(4)}`,
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof BadRequestException) {
            await this.rejectOrder(order.id, message);
          } else {
            this.logger.error(`Error evaluating option order ${order.id}: ${message}`);
          }
        }
      }
    }

    if (evaluated > 0) {
      this.logger.log(`Price monitor: evaluated ${evaluated} orders, filled ${filled}`);
    }
  }

  async fillQueuedMarketOrders(): Promise<void> {
    const marketOrders = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(inArray(orders.status, ['pending', 'partially_filled']), eq(orders.type, 'market')));

    if (marketOrders.length === 0) return;

    const symbols = [...new Set(marketOrders.map((o) => o.symbol))];
    const quotes = await this.marketDataService.getQuotes(symbols);

    let filled = 0;

    for (const order of marketOrders) {
      try {
        const quote = quotes[order.symbol];
        if (!quote) {
          this.logger.warn(`No quote available for ${order.symbol}, skipping order ${order.id}`);
          continue;
        }

        const fillPrice = this.orderEngine.getMarketFillPrice(order.side as OrderSide, quote);
        const fillQuantity = new Decimal(order.quantity).minus(new Decimal(order.filledQuantity));

        await this.orderEngine.executeFill({
          orderId: order.id,
          fillPrice,
          fillQuantity,
        });

        filled++;
        this.logger.log(`Filled queued market order ${order.id} for ${order.symbol} @ ${fillPrice.toFixed(4)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof BadRequestException) {
          await this.rejectOrder(order.id, message);
        } else {
          this.logger.error(`Error filling market order ${order.id}: ${message}`);
        }
      }
    }

    this.logger.log(`Market open: filled ${filled}/${marketOrders.length} queued market orders`);
  }

  private async evaluateTrailingStop(order: typeof orders.$inferSelect, quote: Quote): Promise<void> {
    const currentBid = new Decimal(quote.bidPrice);
    const hwm = new Decimal(order.highWaterMark!);
    const trailingStop = new Decimal(order.trailingStopPrice!);

    // Update high-water mark if price moved up
    if (currentBid.gt(hwm)) {
      let newStopPrice: Decimal;
      if (order.trailPercent) {
        newStopPrice = currentBid.mul(new Decimal(1).minus(new Decimal(order.trailPercent).div(100)));
      } else {
        newStopPrice = currentBid.minus(new Decimal(order.trailPrice!));
      }

      await this.drizzle.db
        .update(orders)
        .set({
          highWaterMark: currentBid.toFixed(4),
          trailingStopPrice: newStopPrice.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      this.logger.log(
        `Trailing stop ${order.id}: HWM updated ${hwm.toFixed(4)} → ${currentBid.toFixed(4)}, stop ${trailingStop.toFixed(4)} → ${newStopPrice.toFixed(4)}`,
      );
      return; // Don't trigger on the same tick as an HWM update
    }

    // Check if stop triggered
    if (currentBid.lte(trailingStop)) {
      const fillQuantity = new Decimal(order.quantity).minus(new Decimal(order.filledQuantity));

      await this.orderEngine.executeFill({
        orderId: order.id,
        fillPrice: currentBid,
        fillQuantity,
      });

      this.logger.log(
        `Trailing stop ${order.id} triggered: ${order.symbol} @ ${currentBid.toFixed(4)} (HWM: ${hwm.toFixed(4)}, stop: ${trailingStop.toFixed(4)})`,
      );
    }
  }

  private async rejectOrder(orderId: string, reason: string): Promise<void> {
    await this.drizzle.db
      .update(orders)
      .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    this.logger.warn(`Rejected order ${orderId}: ${reason}`);
  }
}
