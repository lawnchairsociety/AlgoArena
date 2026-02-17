import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';
import { orderSideEnum, orderStatusEnum, orderTypeEnum, timeInForceEnum } from './enums';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull().default('us_equity'),
  side: orderSideEnum('side').notNull(),
  type: orderTypeEnum('type').notNull(),
  timeInForce: timeInForceEnum('time_in_force').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  filledQuantity: numeric('filled_quantity', { precision: 14, scale: 6 }).notNull().default('0'),
  limitPrice: numeric('limit_price', { precision: 14, scale: 4 }),
  stopPrice: numeric('stop_price', { precision: 14, scale: 4 }),
  trailPercent: numeric('trail_percent', { precision: 6, scale: 4 }),
  trailPrice: numeric('trail_price', { precision: 12, scale: 4 }),
  highWaterMark: numeric('high_water_mark', { precision: 12, scale: 4 }),
  trailingStopPrice: numeric('trailing_stop_price', { precision: 12, scale: 4 }),
  // Bracket / OCO fields
  parentOrderId: uuid('parent_order_id'),
  bracketGroupId: uuid('bracket_group_id'),
  bracketRole: text('bracket_role'), // 'entry' | 'take_profit' | 'stop_loss'
  linkedOrderId: uuid('linked_order_id'), // OCO partner (TP ↔ SL)
  takeProfitLimitPrice: numeric('take_profit_limit_price', { precision: 14, scale: 4 }),
  stopLossStopPrice: numeric('stop_loss_stop_price', { precision: 14, scale: 4 }),
  stopLossLimitPrice: numeric('stop_loss_limit_price', { precision: 14, scale: 4 }),
  // Multi-leg option order grouping
  orderClass: text('order_class'), // 'simple' | 'multileg'
  legGroupId: uuid('leg_group_id'), // shared across legs of a multi-leg order
  avgFillPrice: numeric('avg_fill_price', { precision: 14, scale: 4 }),
  status: orderStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  filledAt: timestamp('filled_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
});
