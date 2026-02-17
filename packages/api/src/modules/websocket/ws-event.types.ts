// ── Internal event payloads (all include cuidUserId as routing key) ──

export interface OrderEventPayload {
  cuidUserId: string;
  orderId: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  status: string;
  filledQuantity?: string;
  avgFillPrice?: string | null;
  rejectionReason?: string | null;
  fillPrice?: string;
  fillQuantity?: string;
  highWaterMark?: string | null;
  trailingStopPrice?: string | null;
  trailPercent?: string | null;
  trailPrice?: string | null;
  bracketRole?: string | null;
  bracketGroupId?: string | null;
  bracket?: {
    takeProfitOrderId?: string;
    stopLossOrderId?: string;
  };
  session?: string;
  extendedHours?: boolean;
}

export interface MarketSessionPayload {
  session: string;
  timestamp: string;
}

export interface MarginWarningPayload {
  cuidUserId: string;
  equity: string;
  maintenanceRequired: string;
  shortPositions: Array<{
    symbol: string;
    quantity: string;
    currentPrice: string;
  }>;
}

export interface MarginLiquidationPayload {
  cuidUserId: string;
  symbol: string;
  quantity: string;
  fillPrice: string;
  coverOrderId: string;
}

export interface PdtWarningPayload {
  cuidUserId: string;
  dayTradeCount: number;
  windowStartDate: string;
}

export interface PdtRestrictedPayload {
  cuidUserId: string;
  dayTradeCount: number;
  equity: string;
}

export interface OptionExpiredPayload {
  cuidUserId: string;
  symbol: string;
  quantity: string;
  result: 'itm_closed' | 'otm_expired';
  underlyingPrice: string;
  strikePrice: string | null;
}

export interface RiskOrderRejectedPayload {
  cuidUserId: string;
  symbol: string;
  violations: string[];
}

export interface RiskLossLimitPayload {
  cuidUserId: string;
  control: string;
  dailyPnlPct: string;
  limit: string;
  action: string;
  positionsClosed: number;
  ordersCancelled: number;
}

export interface RiskWarningPayload {
  cuidUserId: string;
  control: string;
  message: string;
  currentValue: string;
  limit: string;
}
