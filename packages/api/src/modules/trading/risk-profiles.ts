import { RiskProfile } from '@algoarena/shared';

export interface RiskProfileValues {
  maxPositionPct: string | null;
  maxPositionValue: string | null;
  maxPositions: number | null;
  maxOrderValue: string | null;
  maxOrderQuantity: string | null;
  maxPriceDeviationPct: string | null;
  maxDailyTrades: number | null;
  maxDailyNotional: string | null;
  maxDailyLossPct: string | null;
  maxDrawdownPct: string | null;
  autoFlattenOnLoss: boolean;
  shortSellingEnabled: boolean;
  maxShortExposurePct: string | null;
  maxSingleShortPct: string | null;
}

export const RISK_PROFILE_PRESETS: Record<RiskProfile, RiskProfileValues> = {
  conservative: {
    maxPositionPct: '0.1500',
    maxPositionValue: null,
    maxPositions: 20,
    maxOrderValue: null,
    maxOrderQuantity: null,
    maxPriceDeviationPct: '0.0500',
    maxDailyTrades: 20,
    maxDailyNotional: null,
    maxDailyLossPct: '0.0300',
    maxDrawdownPct: '0.1000',
    autoFlattenOnLoss: true,
    shortSellingEnabled: false,
    maxShortExposurePct: '0.0000',
    maxSingleShortPct: '0.0000',
  },
  moderate: {
    maxPositionPct: '0.2500',
    maxPositionValue: null,
    maxPositions: 50,
    maxOrderValue: null,
    maxOrderQuantity: null,
    maxPriceDeviationPct: '0.1000',
    maxDailyTrades: 50,
    maxDailyNotional: null,
    maxDailyLossPct: '0.0500',
    maxDrawdownPct: '0.1500',
    autoFlattenOnLoss: false,
    shortSellingEnabled: true,
    maxShortExposurePct: '0.3000',
    maxSingleShortPct: '0.1000',
  },
  aggressive: {
    maxPositionPct: '0.4000',
    maxPositionValue: null,
    maxPositions: 100,
    maxOrderValue: null,
    maxOrderQuantity: null,
    maxPriceDeviationPct: '0.1500',
    maxDailyTrades: 100,
    maxDailyNotional: null,
    maxDailyLossPct: '0.1000',
    maxDrawdownPct: '0.2500',
    autoFlattenOnLoss: false,
    shortSellingEnabled: true,
    maxShortExposurePct: '0.5000',
    maxSingleShortPct: '0.1500',
  },
  unrestricted: {
    maxPositionPct: null,
    maxPositionValue: null,
    maxPositions: null,
    maxOrderValue: null,
    maxOrderQuantity: null,
    maxPriceDeviationPct: null,
    maxDailyTrades: null,
    maxDailyNotional: null,
    maxDailyLossPct: null,
    maxDrawdownPct: null,
    autoFlattenOnLoss: false,
    shortSellingEnabled: true,
    maxShortExposurePct: null,
    maxSingleShortPct: null,
  },
};
