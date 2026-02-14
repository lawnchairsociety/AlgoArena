import { boolean, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { apiKeys } from './api-keys';

export const cuidUsers = pgTable('cuid_users', {
  id: text('id').primaryKey(), // CUID
  apiKeyId: uuid('api_key_id')
    .notNull()
    .references(() => apiKeys.id),
  label: text('label'),
  startingBalance: numeric('starting_balance', { precision: 14, scale: 2 }).notNull().default('100000.00'),
  cashBalance: numeric('cash_balance', { precision: 14, scale: 2 }).notNull().default('100000.00'),
  marginUsed: numeric('margin_used', { precision: 14, scale: 2 }).notNull().default('0.00'),
  pdtEnforced: boolean('pdt_enforced').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
