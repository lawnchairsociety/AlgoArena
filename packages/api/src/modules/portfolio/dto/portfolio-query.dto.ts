import { ANALYTICS_PERIODS, AnalyticsPeriod, OrderSide } from '@algoarena/shared';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class PortfolioHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class TradeHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  symbol?: string;
}

// ── Analytics DTOs ──

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{1,5}$/, { message: 'benchmark must be 1-5 uppercase letters' })
  benchmark?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;
}

export class EnhancedTradeHistoryQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsIn(['buy', 'sell'])
  side?: OrderSide;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
