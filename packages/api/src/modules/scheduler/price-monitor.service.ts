import { Injectable, Logger } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { DrizzleProvider } from '../database/drizzle.provider';
import { orders } from '../database/schema';
import { MarketDataService } from '../market-data/market-data.service';
import { OrderEngineService } from '../trading/order-engine.service';
import type { OrderSide, OrderType } from '@algoarena/shared';

@Injectable()
export class PriceMonitorService {
  private readonly logger = new Logger(PriceMonitorService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly marketDataService: MarketDataService,
    private readonly orderEngine: OrderEngineService,
  ) {}

  async evaluatePendingOrders(): Promise<void> {
    const pendingOrders = await this.drizzle.db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['pending', 'partially_filled']),
          inArray(orders.type, ['limit', 'stop', 'stop_limit']),
        ),
      );

    if (pendingOrders.length === 0) return;

    const symbols = [...new Set(pendingOrders.map((o) => o.symbol))];
    const quotes = await this.marketDataService.getQuotes(symbols);

    let evaluated = 0;
    let filled = 0;

    for (const order of pendingOrders) {
      try {
        const quote = quotes[order.symbol];
        if (!quote) continue;

        const fillPrice = this.orderEngine.evaluateOrderConditions(
          order.type as OrderType,
          order.side as OrderSide,
          quote,
          order.limitPrice,
          order.stopPrice,
        );

        evaluated++;

        if (fillPrice) {
          const fillQuantity = new Decimal(order.quantity).minus(
            new Decimal(order.filledQuantity),
          );

          await this.orderEngine.executeFill({
            orderId: order.id,
            fillPrice,
            fillQuantity,
          });

          filled++;
          this.logger.log(
            `Filled ${order.type} order ${order.id} for ${order.symbol} @ ${fillPrice.toFixed(4)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating order ${order.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (evaluated > 0) {
      this.logger.log(
        `Price monitor: evaluated ${evaluated} orders, filled ${filled}`,
      );
    }
  }

  async fillQueuedMarketOrders(): Promise<void> {
    const marketOrders = await this.drizzle.db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['pending', 'partially_filled']),
          eq(orders.type, 'market'),
        ),
      );

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

        const fillPrice = this.orderEngine.getMarketFillPrice(
          order.side as OrderSide,
          quote,
        );
        const fillQuantity = new Decimal(order.quantity).minus(
          new Decimal(order.filledQuantity),
        );

        await this.orderEngine.executeFill({
          orderId: order.id,
          fillPrice,
          fillQuantity,
        });

        filled++;
        this.logger.log(
          `Filled queued market order ${order.id} for ${order.symbol} @ ${fillPrice.toFixed(4)}`,
        );
      } catch (error) {
        this.logger.error(
          `Error filling market order ${order.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Market open: filled ${filled}/${marketOrders.length} queued market orders`);
  }
}
