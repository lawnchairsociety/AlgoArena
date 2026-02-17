import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { DrizzleProvider } from '../database/drizzle.provider';
import { cuidUsers, fills, portfolioSnapshots, positions, riskControls, riskEvents } from '../database/schema';
import { Quote } from '../market-data/types/market-data-provider.types';
import { PlaceOrderDto } from './dto/place-order.dto';
import { RiskEventsQueryDto, UpdateRiskControlsDto } from './dto/risk-control.dto';
import { RISK_PROFILE_PRESETS, RiskProfileValues } from './risk-profiles';

export interface RiskValidationParams {
  dto: PlaceOrderDto;
  user: CuidUserRecord;
  existingPosition: { quantity: string; avgCostBasis: string } | null;
  quote: Quote;
  totalEquity: Decimal;
  isOption: boolean;
  isCrypto: boolean;
  effectiveMultiplier: number;
}

const DEFAULT_CONTROLS: RiskProfileValues = {
  maxPositionPct: '0.2500',
  maxPositionValue: null,
  maxPositions: 50,
  maxOrderValue: null,
  maxOrderQuantity: null,
  maxPriceDeviationPct: '0.1000',
  maxDailyTrades: 100,
  maxDailyNotional: null,
  maxDailyLossPct: null,
  maxDrawdownPct: null,
  autoFlattenOnLoss: false,
  shortSellingEnabled: true,
  maxShortExposurePct: '0.5000',
  maxSingleShortPct: '0.1500',
};

@Injectable()
export class RiskControlService {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Get Controls ──

  async getControls(userId: string): Promise<RiskProfileValues> {
    const [row] = await this.drizzle.db.select().from(riskControls).where(eq(riskControls.userId, userId)).limit(1);

    if (!row) return { ...DEFAULT_CONTROLS };

    return {
      maxPositionPct: row.maxPositionPct,
      maxPositionValue: row.maxPositionValue,
      maxPositions: row.maxPositions,
      maxOrderValue: row.maxOrderValue,
      maxOrderQuantity: row.maxOrderQuantity,
      maxPriceDeviationPct: row.maxPriceDeviationPct,
      maxDailyTrades: row.maxDailyTrades,
      maxDailyNotional: row.maxDailyNotional,
      maxDailyLossPct: row.maxDailyLossPct,
      maxDrawdownPct: row.maxDrawdownPct,
      autoFlattenOnLoss: row.autoFlattenOnLoss,
      shortSellingEnabled: row.shortSellingEnabled,
      maxShortExposurePct: row.maxShortExposurePct,
      maxSingleShortPct: row.maxSingleShortPct,
    };
  }

  // ── Get Controls With Status ──

  async getControlsWithStatus(userId: string) {
    const controls = await this.getControls(userId);

    const todayStart = this.getTodayStartUTC();

    // Daily trade count + notional
    const todayFills = await this.drizzle.db
      .select({
        count: sql<number>`count(*)::int`,
        totalNotional: sql<string>`coalesce(sum(abs(${fills.totalCost}::numeric)), 0)::text`,
      })
      .from(fills)
      .where(and(eq(fills.cuidUserId, userId), gte(fills.filledAt, todayStart)));

    const dailyTradeCount = todayFills[0]?.count ?? 0;
    const dailyNotional = todayFills[0]?.totalNotional ?? '0';

    // Positions
    const userPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));
    const positionCount = userPositions.length;

    // Compute position values for concentration + short exposure
    let largestPositionPct = new Decimal(0);
    let shortExposure = new Decimal(0);
    let totalPositionsValue = new Decimal(0);

    // We need equity for percentage calcs — use cash + sum of totalCostBasis as approximation
    // since we don't have quotes here
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, userId)).limit(1);

    const cash = user ? new Decimal(user.cashBalance) : new Decimal(0);
    const startingBalance = user ? new Decimal(user.startingBalance) : new Decimal(100000);

    for (const pos of userPositions) {
      const qty = new Decimal(pos.quantity);
      const costBasis = new Decimal(pos.avgCostBasis);
      const posValue = qty.abs().mul(costBasis);
      totalPositionsValue = totalPositionsValue.plus(qty.mul(costBasis));

      if (qty.lt(0)) {
        shortExposure = shortExposure.plus(posValue);
      }
    }

    const totalEquity = cash.plus(totalPositionsValue);
    const totalPnl = totalEquity.minus(startingBalance);
    const dailyPnlPct = startingBalance.gt(0) ? totalPnl.div(startingBalance) : new Decimal(0);

    if (totalEquity.gt(0)) {
      for (const pos of userPositions) {
        const qty = new Decimal(pos.quantity);
        const costBasis = new Decimal(pos.avgCostBasis);
        const posValue = qty.abs().mul(costBasis);
        const pct = posValue.div(totalEquity);
        if (pct.gt(largestPositionPct)) {
          largestPositionPct = pct;
        }
      }
    }

    const shortExposurePct = totalEquity.gt(0) ? shortExposure.div(totalEquity) : new Decimal(0);

    // Drawdown from peak (latest snapshot peak)
    const peakSnapshot = await this.drizzle.db
      .select({ totalEquity: portfolioSnapshots.totalEquity })
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.cuidUserId, userId))
      .orderBy(desc(sql`${portfolioSnapshots.totalEquity}::numeric`))
      .limit(1);

    const peakEquity = peakSnapshot.length > 0 ? new Decimal(peakSnapshot[0].totalEquity) : startingBalance;
    const currentDrawdown = peakEquity.gt(0) ? totalEquity.minus(peakEquity).div(peakEquity) : new Decimal(0);

    // Restriction check
    let isRestricted = false;
    let restrictionReason: string | null = null;

    if (controls.maxDailyLossPct !== null && dailyPnlPct.lt(0)) {
      const lossPct = dailyPnlPct.abs();
      if (lossPct.gte(new Decimal(controls.maxDailyLossPct))) {
        isRestricted = true;
        restrictionReason = `Daily loss limit reached (${lossPct.mul(100).toFixed(2)}%)`;
      }
    }

    if (!isRestricted && controls.maxDrawdownPct !== null && currentDrawdown.lt(0)) {
      const ddPct = currentDrawdown.abs();
      if (ddPct.gte(new Decimal(controls.maxDrawdownPct))) {
        isRestricted = true;
        restrictionReason = `Drawdown limit reached (${ddPct.mul(100).toFixed(2)}%)`;
      }
    }

    if (!isRestricted && controls.maxDailyTrades !== null && dailyTradeCount >= controls.maxDailyTrades) {
      isRestricted = true;
      restrictionReason = `Daily trade limit reached (${dailyTradeCount}/${controls.maxDailyTrades})`;
    }

    return {
      userId,
      controls,
      status: {
        dailyTradeCount,
        dailyNotional,
        dailyPnl: totalPnl.toFixed(2),
        dailyPnlPct: dailyPnlPct.toFixed(6),
        currentDrawdown: currentDrawdown.toFixed(6),
        shortExposurePct: shortExposurePct.toFixed(6),
        largestPositionPct: largestPositionPct.toFixed(6),
        positionCount,
        isRestricted,
        restrictionReason,
      },
    };
  }

  // ── Update Controls ──

  async updateControls(userId: string, dto: UpdateRiskControlsDto) {
    // Start with profile preset if specified
    let values: Partial<typeof riskControls.$inferInsert> = {};

    if (dto.profile) {
      const preset = RISK_PROFILE_PRESETS[dto.profile];
      values = {
        maxPositionPct: preset.maxPositionPct,
        maxPositionValue: preset.maxPositionValue,
        maxPositions: preset.maxPositions,
        maxOrderValue: preset.maxOrderValue,
        maxOrderQuantity: preset.maxOrderQuantity,
        maxPriceDeviationPct: preset.maxPriceDeviationPct,
        maxDailyTrades: preset.maxDailyTrades,
        maxDailyNotional: preset.maxDailyNotional,
        maxDailyLossPct: preset.maxDailyLossPct,
        maxDrawdownPct: preset.maxDrawdownPct,
        autoFlattenOnLoss: preset.autoFlattenOnLoss,
        shortSellingEnabled: preset.shortSellingEnabled,
        maxShortExposurePct: preset.maxShortExposurePct,
        maxSingleShortPct: preset.maxSingleShortPct,
      };
    }

    // Override with any explicit values from the DTO
    if (dto.maxPositionPct !== undefined) values.maxPositionPct = dto.maxPositionPct;
    if (dto.maxPositionValue !== undefined) values.maxPositionValue = dto.maxPositionValue;
    if (dto.maxPositions !== undefined) values.maxPositions = dto.maxPositions;
    if (dto.maxOrderValue !== undefined) values.maxOrderValue = dto.maxOrderValue;
    if (dto.maxOrderQuantity !== undefined) values.maxOrderQuantity = dto.maxOrderQuantity;
    if (dto.maxPriceDeviationPct !== undefined) values.maxPriceDeviationPct = dto.maxPriceDeviationPct;
    if (dto.maxDailyTrades !== undefined) values.maxDailyTrades = dto.maxDailyTrades;
    if (dto.maxDailyNotional !== undefined) values.maxDailyNotional = dto.maxDailyNotional;
    if (dto.maxDailyLossPct !== undefined) values.maxDailyLossPct = dto.maxDailyLossPct;
    if (dto.maxDrawdownPct !== undefined) values.maxDrawdownPct = dto.maxDrawdownPct;
    if (dto.autoFlattenOnLoss !== undefined) values.autoFlattenOnLoss = dto.autoFlattenOnLoss;
    if (dto.shortSellingEnabled !== undefined) values.shortSellingEnabled = dto.shortSellingEnabled;
    if (dto.maxShortExposurePct !== undefined) values.maxShortExposurePct = dto.maxShortExposurePct;
    if (dto.maxSingleShortPct !== undefined) values.maxSingleShortPct = dto.maxSingleShortPct;

    values.updatedAt = new Date();

    await this.drizzle.db
      .insert(riskControls)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: riskControls.userId,
        set: values,
      });

    return this.getControls(userId);
  }

  // ── Validate Order ──

  async validateOrder(userId: string, params: RiskValidationParams): Promise<void> {
    const controls = await this.getControls(userId);
    const violations: string[] = [];
    const { dto, existingPosition, quote, totalEquity, isOption, isCrypto, effectiveMultiplier } = params;

    const fillQuantity = new Decimal(dto.quantity);
    const currentPositionQty = existingPosition ? new Decimal(existingPosition.quantity) : new Decimal(0);
    const askPrice = new Decimal(quote.askPrice);

    // 1. Position count
    if (controls.maxPositions !== null) {
      const isNewPosition = currentPositionQty.isZero();
      if (isNewPosition && dto.side === 'buy') {
        const posCount = await this.drizzle.db
          .select({ count: sql<number>`count(*)::int` })
          .from(positions)
          .where(eq(positions.cuidUserId, userId));
        if ((posCount[0]?.count ?? 0) >= controls.maxPositions) {
          violations.push(`Maximum positions (${controls.maxPositions}) reached`);
        }
      }
    }

    // 2. Position concentration
    if (totalEquity.gt(0)) {
      const postOrderQty =
        dto.side === 'buy' ? currentPositionQty.plus(fillQuantity) : currentPositionQty.minus(fillQuantity);
      const postOrderValue = postOrderQty.abs().mul(askPrice).mul(effectiveMultiplier);
      const concentrationPct = postOrderValue.div(totalEquity);

      if (controls.maxPositionPct !== null && concentrationPct.gt(new Decimal(controls.maxPositionPct))) {
        violations.push(
          `Position concentration ${concentrationPct.mul(100).toFixed(1)}% exceeds limit of ${new Decimal(controls.maxPositionPct).mul(100).toFixed(1)}%`,
        );
      }

      if (controls.maxPositionValue !== null && postOrderValue.gt(new Decimal(controls.maxPositionValue))) {
        violations.push(
          `Position value $${postOrderValue.toFixed(2)} exceeds limit of $${new Decimal(controls.maxPositionValue).toFixed(2)}`,
        );
      }
    }

    // 3. Order size
    const orderNotional = askPrice.mul(fillQuantity).mul(effectiveMultiplier);

    if (controls.maxOrderValue !== null && orderNotional.gt(new Decimal(controls.maxOrderValue))) {
      violations.push(
        `Order value $${orderNotional.toFixed(2)} exceeds limit of $${new Decimal(controls.maxOrderValue).toFixed(2)}`,
      );
    }

    if (controls.maxOrderQuantity !== null && fillQuantity.gt(new Decimal(controls.maxOrderQuantity))) {
      violations.push(
        `Order quantity ${fillQuantity.toFixed(6)} exceeds limit of ${new Decimal(controls.maxOrderQuantity).toFixed(6)}`,
      );
    }

    // 4. Price deviation (for limit/stop orders)
    if (controls.maxPriceDeviationPct !== null) {
      const midPrice = askPrice.plus(new Decimal(quote.bidPrice)).div(2);
      if (midPrice.gt(0)) {
        if (dto.limitPrice) {
          const deviation = new Decimal(dto.limitPrice).minus(midPrice).abs().div(midPrice);
          if (deviation.gt(new Decimal(controls.maxPriceDeviationPct))) {
            violations.push(
              `Limit price deviation ${deviation.mul(100).toFixed(1)}% exceeds limit of ${new Decimal(controls.maxPriceDeviationPct).mul(100).toFixed(1)}%`,
            );
          }
        }
        if (dto.stopPrice) {
          const deviation = new Decimal(dto.stopPrice).minus(midPrice).abs().div(midPrice);
          if (deviation.gt(new Decimal(controls.maxPriceDeviationPct))) {
            violations.push(
              `Stop price deviation ${deviation.mul(100).toFixed(1)}% exceeds limit of ${new Decimal(controls.maxPriceDeviationPct).mul(100).toFixed(1)}%`,
            );
          }
        }
      }
    }

    // 5. Daily trade count
    if (controls.maxDailyTrades !== null) {
      const todayStart = this.getTodayStartUTC();
      const todayFills = await this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fills)
        .where(and(eq(fills.cuidUserId, userId), gte(fills.filledAt, todayStart)));

      if ((todayFills[0]?.count ?? 0) >= controls.maxDailyTrades) {
        violations.push(`Daily trade limit (${controls.maxDailyTrades}) reached`);
      }
    }

    // 6. Daily notional
    if (controls.maxDailyNotional !== null) {
      const todayStart = this.getTodayStartUTC();
      const todayNotional = await this.drizzle.db
        .select({
          total: sql<string>`coalesce(sum(abs(${fills.totalCost}::numeric)), 0)::text`,
        })
        .from(fills)
        .where(and(eq(fills.cuidUserId, userId), gte(fills.filledAt, todayStart)));

      const currentNotional = new Decimal(todayNotional[0]?.total ?? '0');
      const postNotional = currentNotional.plus(orderNotional);
      if (postNotional.gt(new Decimal(controls.maxDailyNotional))) {
        violations.push(
          `Daily notional $${postNotional.toFixed(2)} would exceed limit of $${new Decimal(controls.maxDailyNotional).toFixed(2)}`,
        );
      }
    }

    // 7. Daily loss limit
    if (controls.maxDailyLossPct !== null && totalEquity.gt(0)) {
      const startingBalance = new Decimal(params.user.startingBalance);
      const dailyPnlPct = totalEquity.minus(startingBalance).div(startingBalance);
      if (dailyPnlPct.lt(0) && dailyPnlPct.abs().gte(new Decimal(controls.maxDailyLossPct))) {
        if (controls.autoFlattenOnLoss) {
          this.eventEmitter.emit('risk.auto_flatten', {
            cuidUserId: userId,
            controlName: 'maxDailyLossPct',
            message: `Daily loss ${dailyPnlPct.abs().mul(100).toFixed(2)}% exceeds limit of ${new Decimal(controls.maxDailyLossPct).mul(100).toFixed(2)}%`,
          });
        }
        violations.push(
          `Daily loss ${dailyPnlPct.abs().mul(100).toFixed(2)}% exceeds limit of ${new Decimal(controls.maxDailyLossPct).mul(100).toFixed(2)}%`,
        );
      }
    }

    // 8. Drawdown
    if (controls.maxDrawdownPct !== null && totalEquity.gt(0)) {
      const startingBalance = new Decimal(params.user.startingBalance);
      const peakSnapshot = await this.drizzle.db
        .select({ totalEquity: portfolioSnapshots.totalEquity })
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.cuidUserId, userId))
        .orderBy(desc(sql`${portfolioSnapshots.totalEquity}::numeric`))
        .limit(1);

      const peakEquity = peakSnapshot.length > 0 ? new Decimal(peakSnapshot[0].totalEquity) : startingBalance;
      if (peakEquity.gt(0)) {
        const drawdown = peakEquity.minus(totalEquity).div(peakEquity);
        if (drawdown.gt(0) && drawdown.gte(new Decimal(controls.maxDrawdownPct))) {
          if (controls.autoFlattenOnLoss) {
            this.eventEmitter.emit('risk.auto_flatten', {
              cuidUserId: userId,
              controlName: 'maxDrawdownPct',
              message: `Drawdown ${drawdown.mul(100).toFixed(2)}% exceeds limit of ${new Decimal(controls.maxDrawdownPct).mul(100).toFixed(2)}%`,
            });
          }
          violations.push(
            `Drawdown ${drawdown.mul(100).toFixed(2)}% exceeds limit of ${new Decimal(controls.maxDrawdownPct).mul(100).toFixed(2)}%`,
          );
        }
      }
    }

    // 9. Short selling checks
    if (!isOption && !isCrypto) {
      const isShortSell = dto.side === 'sell' && (currentPositionQty.lte(0) || fillQuantity.gt(currentPositionQty));

      if (isShortSell) {
        if (!controls.shortSellingEnabled) {
          violations.push('Short selling is disabled by risk controls');
        }

        if (controls.maxShortExposurePct !== null && totalEquity.gt(0)) {
          // Current short exposure
          const userPositions = await this.drizzle.db.select().from(positions).where(eq(positions.cuidUserId, userId));

          let shortExposure = new Decimal(0);
          for (const pos of userPositions) {
            const qty = new Decimal(pos.quantity);
            if (qty.lt(0)) {
              shortExposure = shortExposure.plus(qty.abs().mul(new Decimal(pos.avgCostBasis)));
            }
          }

          // Add new short exposure from this order
          const newShortQty = currentPositionQty.gt(0) ? fillQuantity.minus(currentPositionQty) : fillQuantity;
          const newShortExposure = shortExposure.plus(newShortQty.mul(askPrice));
          const shortPct = newShortExposure.div(totalEquity);

          if (shortPct.gt(new Decimal(controls.maxShortExposurePct))) {
            violations.push(
              `Short exposure ${shortPct.mul(100).toFixed(1)}% would exceed limit of ${new Decimal(controls.maxShortExposurePct).mul(100).toFixed(1)}%`,
            );
          }
        }

        if (controls.maxSingleShortPct !== null && totalEquity.gt(0)) {
          const newShortQty = currentPositionQty.gt(0) ? fillQuantity.minus(currentPositionQty) : fillQuantity;
          const postShortQty = currentPositionQty.lt(0) ? currentPositionQty.abs().plus(newShortQty) : newShortQty;
          const singleShortValue = postShortQty.mul(askPrice);
          const singleShortPct = singleShortValue.div(totalEquity);

          if (singleShortPct.gt(new Decimal(controls.maxSingleShortPct))) {
            violations.push(
              `Single short position ${singleShortPct.mul(100).toFixed(1)}% would exceed limit of ${new Decimal(controls.maxSingleShortPct).mul(100).toFixed(1)}%`,
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      await this.recordEvent(userId, 'order_rejected', violations[0].split(' ')[0], 'Order rejected by risk controls', {
        violations,
        symbol: dto.symbol,
        side: dto.side,
        quantity: dto.quantity,
      });

      this.eventEmitter.emit('risk.order_rejected', {
        cuidUserId: userId,
        symbol: dto.symbol,
        violations,
      });

      throw new BadRequestException({
        message: 'Order rejected by risk controls',
        violations,
      });
    }
  }

  // ── Get Events ──

  async getEvents(userId: string, query: RiskEventsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const events = await this.drizzle.db
      .select()
      .from(riskEvents)
      .where(eq(riskEvents.userId, userId))
      .orderBy(desc(riskEvents.timestamp))
      .limit(limit)
      .offset(offset);

    return {
      events: events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        type: e.eventType,
        control: e.controlName,
        message: e.message,
        details: e.details ?? {},
        orderId: e.orderId,
      })),
    };
  }

  // ── Record Event ──

  async recordEvent(
    userId: string,
    eventType: string,
    controlName: string,
    message: string,
    details?: Record<string, unknown>,
    orderId?: string,
  ): Promise<void> {
    await this.drizzle.db.insert(riskEvents).values({
      userId,
      eventType,
      controlName,
      message,
      details: details ?? null,
      orderId: orderId ?? null,
    });
  }

  // ── Private Helpers ──

  private getTodayStartUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
