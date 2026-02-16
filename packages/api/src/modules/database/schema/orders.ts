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
  avgFillPrice: numeric('avg_fill_price', { precision: 14, scale: 4 }),
  status: orderStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  filledAt: timestamp('filled_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
});
