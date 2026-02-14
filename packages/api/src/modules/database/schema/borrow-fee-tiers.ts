import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { borrowTierEnum } from './enums';

export const borrowFeeTiers = pgTable('borrow_fee_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: text('symbol').notNull(),
  tier: borrowTierEnum('tier').notNull(),
  annualRate: numeric('annual_rate', { precision: 8, scale: 4 }).notNull(),
  marketCap: numeric('market_cap', { precision: 20, scale: 2 }),
  shortInterestPct: numeric('short_interest_pct', { precision: 8, scale: 4 }),
  daysToCover: numeric('days_to_cover', { precision: 8, scale: 2 }),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
});
