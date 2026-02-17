import { numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';

export const positions = pgTable('positions', {
  id: text('id').primaryKey(), // composite: {cuid}:{symbol}
  cuidUserId: text('cuid_user_id')
    .notNull()
    .references(() => cuidUsers.id),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull().default('us_equity'),
  quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
  avgCostBasis: numeric('avg_cost_basis', { precision: 14, scale: 4 }).notNull(),
  totalCostBasis: numeric('total_cost_basis', { precision: 14, scale: 2 }).notNull(),
  // Option metadata (nullable — only set for option positions)
  optionType: text('option_type'), // 'call' | 'put'
  strikePrice: numeric('strike_price', { precision: 12, scale: 4 }),
  expiration: text('expiration'), // 'YYYY-MM-DD'
  underlyingSymbol: text('underlying_symbol'),
  multiplier: numeric('multiplier', { precision: 6, scale: 0 }).default('1'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
