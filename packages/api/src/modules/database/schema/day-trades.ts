import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { cuidUsers } from './cuid-users';

export const dayTrades = pgTable('day_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  buyOrderId: uuid('buy_order_id')
    .notNull()
    .references(() => orders.id),
  sellOrderId: uuid('sell_order_id')
    .notNull()
    .references(() => orders.id),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  buyPrice: numeric('buy_price', { precision: 14, scale: 4 }).notNull(),
  sellPrice: numeric('sell_price', { precision: 14, scale: 4 }).notNull(),
  tradeDate: date('trade_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
