import { RISK_PROFILES, RiskProfile } from '@algoarena/shared';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateRiskControlsDto {
  @IsOptional()
  @IsIn([...RISK_PROFILES])
  profile?: RiskProfile;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPositionPct?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPositionValue?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  maxPositions?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxOrderValue?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxOrderQuantity?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPriceDeviationPct?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxDailyTrades?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDailyNotional?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDailyLossPct?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDrawdownPct?: string | null;

  @IsOptional()
  @IsBoolean()
  autoFlattenOnLoss?: boolean;

  @IsOptional()
  @IsBoolean()
  shortSellingEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxShortExposurePct?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxSingleShortPct?: string | null;
}

export class RiskEventsQueryDto {
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
}
