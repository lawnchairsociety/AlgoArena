import { BORROW_TIERS, ORDER_SIDES, ORDER_STATUSES, ORDER_TYPES, TIME_IN_FORCE_VALUES } from '@algoarena/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const orderSideEnum = pgEnum('order_side', ORDER_SIDES);
export const orderTypeEnum = pgEnum('order_type', ORDER_TYPES);
export const timeInForceEnum = pgEnum('time_in_force', TIME_IN_FORCE_VALUES);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const borrowTierEnum = pgEnum('borrow_tier', BORROW_TIERS);
