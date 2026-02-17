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
