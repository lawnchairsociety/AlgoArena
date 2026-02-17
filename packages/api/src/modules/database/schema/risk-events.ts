import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cuidUsers } from './cuid-users';

export const riskEvents = pgTable('risk_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => cuidUsers.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  eventType: text('event_type').notNull(),
  controlName: text('control_name').notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  orderId: uuid('order_id'),
});
