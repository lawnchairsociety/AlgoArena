import { date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';

export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  snapshotDate: date('snapshot_date').notNull(),
  cashBalance: numeric('cash_balance', { precision: 14, scale: 2 }).notNull(),
  positionsValue: numeric('positions_value', { precision: 14, scale: 2 }).notNull(),
  totalEquity: numeric('total_equity', { precision: 14, scale: 2 }).notNull(),
  dayPnl: numeric('day_pnl', { precision: 14, scale: 2 }).notNull(),
  totalPnl: numeric('total_pnl', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
