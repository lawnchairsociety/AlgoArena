import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ORDER_SIDES,
  ORDER_TYPES,
  TIME_IN_FORCE_VALUES,
  ORDER_STATUSES,
  BORROW_TIERS,
} from '@algoarena/shared';

export const orderSideEnum = pgEnum('order_side', ORDER_SIDES);
export const orderTypeEnum = pgEnum('order_type', ORDER_TYPES);
export const timeInForceEnum = pgEnum('time_in_force', TIME_IN_FORCE_VALUES);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const borrowTierEnum = pgEnum('borrow_tier', BORROW_TIERS);
