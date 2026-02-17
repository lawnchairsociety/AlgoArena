import { boolean, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';

export const riskControls = pgTable('risk_controls', {
  userId: text('user_id')
    .primaryKey()
    .references(() => cuidUsers.id),
  maxPositionPct: numeric('max_position_pct', { precision: 6, scale: 4 }).default('0.25'),
  maxPositionValue: numeric('max_position_value', { precision: 14, scale: 2 }),
  maxPositions: integer('max_positions').default(50),
  maxOrderValue: numeric('max_order_value', { precision: 14, scale: 2 }),
  maxOrderQuantity: numeric('max_order_quantity', { precision: 14, scale: 6 }),
  maxPriceDeviationPct: numeric('max_price_deviation_pct', { precision: 6, scale: 4 }).default('0.10'),
  maxDailyTrades: integer('max_daily_trades').default(100),
  maxDailyNotional: numeric('max_daily_notional', { precision: 14, scale: 2 }),
  maxDailyLossPct: numeric('max_daily_loss_pct', { precision: 6, scale: 4 }),
  maxDrawdownPct: numeric('max_drawdown_pct', { precision: 6, scale: 4 }),
  autoFlattenOnLoss: boolean('auto_flatten_on_loss').notNull().default(false),
  shortSellingEnabled: boolean('short_selling_enabled').notNull().default(true),
  maxShortExposurePct: numeric('max_short_exposure_pct', { precision: 6, scale: 4 }).default('0.50'),
  maxSingleShortPct: numeric('max_single_short_pct', { precision: 6, scale: 4 }).default('0.15'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
