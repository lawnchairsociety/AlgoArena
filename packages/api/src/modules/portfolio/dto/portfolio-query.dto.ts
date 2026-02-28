import { ANALYTICS_PERIODS, AnalyticsPeriod, OrderSide } from '@algoarena/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class PortfolioHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Number of days of history', minimum: 1, maximum: 365, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class TradeHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Max number of results', minimum: 1, maximum: 100, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', minimum: 0, default: 0, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Filter by symbol', example: 'AAPL' })
  @IsOptional()
  @IsString()
  symbol?: string;
}

// ── Analytics DTOs ──

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Analytics time period', enum: ANALYTICS_PERIODS })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({ description: 'Benchmark symbol (1-5 uppercase letters)', example: 'SPY' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{1,5}$/, { message: 'benchmark must be 1-5 uppercase letters' })
  benchmark?: string;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ description: 'History time period', enum: ANALYTICS_PERIODS })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;
}

export class EnhancedTradeHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by symbol', example: 'AAPL' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ description: 'Filter by side', enum: ['buy', 'sell'] })
  @IsOptional()
  @IsIn(['buy', 'sell'])
  side?: OrderSide;

  @ApiPropertyOptional({ description: 'Max number of results', minimum: 1, maximum: 500, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', minimum: 0, default: 0, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
