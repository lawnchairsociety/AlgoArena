import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { orderSideEnum } from './enums';
import { orders } from './orders';
import { cuidUsers } from './cuid-users';

export const fills = pgTable('fills', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id),
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  side: orderSideEnum('side').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  price: numeric('price', { precision: 14, scale: 4 }).notNull(),
  totalCost: numeric('total_cost', { precision: 14, scale: 2 }).notNull(),
  filledAt: timestamp('filled_at', { withTimezone: true }).notNull().defaultNow(),
});
