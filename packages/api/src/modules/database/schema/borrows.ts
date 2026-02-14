import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { borrowTierEnum } from './enums';
import { cuidUsers } from './cuid-users';

export const borrows = pgTable('borrows', {
  id: uuid('id').primaryKey().defaultRandom(),
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  entryPrice: numeric('entry_price', { precision: 14, scale: 4 }).notNull(),
  borrowRate: numeric('borrow_rate', { precision: 8, scale: 4 }).notNull(),
  borrowTier: borrowTierEnum('borrow_tier').notNull(),
  accruedFees: numeric('accrued_fees', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});
