// ── Asset classes ──

export const ASSET_CLASSES = ['us_equity', 'crypto', 'option'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

// ── Enum value arrays (single source of truth for TS types + Drizzle pgEnums) ──

export const ORDER_SIDES = ['buy', 'sell'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const TIME_IN_FORCE_VALUES = ['day', 'gtc', 'ioc', 'fok'] as const;
export type TimeInForce = (typeof TIME_IN_FORCE_VALUES)[number];

export const ORDER_STATUSES = ['pending', 'filled', 'partially_filled', 'cancelled', 'expired', 'rejected'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const BORROW_TIERS = ['easy', 'moderate', 'hard', 'not_shortable'] as const;
export type BorrowTier = (typeof BORROW_TIERS)[number];

// ── Custom header names ──

export const HEADER_API_KEY = 'x-algoarena-api-key';
export const HEADER_CUID = 'x-algoarena-cuid';
export const HEADER_MASTER_KEY = 'x-master-key';

// ── WebSocket event types ──

export const WS_EVENT_TYPES = [
  'order.filled',
  'order.partially_filled',
  'order.cancelled',
  'order.rejected',
  'order.expired',
  'margin.warning',
  'margin.liquidation',
  'pdt.warning',
  'pdt.restricted',
  'option.expired',
  'market.session',
  'risk.order_rejected',
  'risk.loss_limit',
  'risk.warning',
  'heartbeat',
] as const;

export type WsEventType = (typeof WS_EVENT_TYPES)[number];

// ── Options-specific allowed values ──

export const OPTIONS_ALLOWED_ORDER_TYPES = ['market', 'limit'] as const;
export const OPTIONS_ALLOWED_TIF = ['day', 'gtc'] as const;

// ── Market sessions ──

export const MARKET_SESSIONS = ['pre_market', 'regular', 'after_hours', 'closed'] as const;
export type MarketSession = (typeof MARKET_SESSIONS)[number];

// ── Extended hours allowed values ──

export const EXTENDED_HOURS_ALLOWED_ORDER_TYPES = ['limit'] as const;
export const EXTENDED_HOURS_ALLOWED_TIF = ['day', 'gtc'] as const;

export interface WsEventEnvelope<T = unknown> {
  type: WsEventType;
  timestamp: string;
  data: T;
}

// ── Analytics ──

export const ANALYTICS_PERIODS = ['7d', '30d', '90d', 'ytd', '1y', 'all'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
