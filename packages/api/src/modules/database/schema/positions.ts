import { numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';

export const positions = pgTable('positions', {
  id: text('id').primaryKey(), // composite: {cuid}:{symbol}
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  avgCostBasis: numeric('avg_cost_basis', { precision: 14, scale: 4 }).notNull(),
  totalCostBasis: numeric('total_cost_basis', { precision: 14, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
