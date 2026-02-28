import { RISK_PROFILES, RiskProfile } from '@algoarena/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateRiskControlsDto {
  @ApiPropertyOptional({ description: 'Risk profile preset', enum: [...RISK_PROFILES] })
  @IsOptional()
  @IsIn([...RISK_PROFILES])
  profile?: RiskProfile;

  @ApiPropertyOptional({
    description: 'Max single position as % of equity (null to clear)',
    example: '10',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPositionPct?: string | null;

  @ApiPropertyOptional({
    description: 'Max single position value in dollars (null to clear)',
    example: '50000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPositionValue?: string | null;

  @ApiPropertyOptional({
    description: 'Max number of open positions (null to clear)',
    minimum: 1,
    maximum: 1000,
    example: 20,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  maxPositions?: number | null;

  @ApiPropertyOptional({
    description: 'Max single order value in dollars (null to clear)',
    example: '25000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxOrderValue?: string | null;

  @ApiPropertyOptional({ description: 'Max single order quantity (null to clear)', example: '1000', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxOrderQuantity?: string | null;

  @ApiPropertyOptional({
    description: 'Max price deviation % from last quote (null to clear)',
    example: '5',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxPriceDeviationPct?: string | null;

  @ApiPropertyOptional({ description: 'Max trades per day (null to clear)', minimum: 1, example: 50, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxDailyTrades?: number | null;

  @ApiPropertyOptional({
    description: 'Max daily notional volume in dollars (null to clear)',
    example: '500000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDailyNotional?: string | null;

  @ApiPropertyOptional({ description: 'Max daily loss as % of equity (null to clear)', example: '5', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDailyLossPct?: string | null;

  @ApiPropertyOptional({
    description: 'Max drawdown from peak as % of equity (null to clear)',
    example: '15',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxDrawdownPct?: string | null;

  @ApiPropertyOptional({ description: 'Auto-flatten all positions when daily loss limit is hit', example: false })
  @IsOptional()
  @IsBoolean()
  autoFlattenOnLoss?: boolean;

  @ApiPropertyOptional({ description: 'Allow short selling', example: false })
  @IsOptional()
  @IsBoolean()
  shortSellingEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Max total short exposure as % of equity (null to clear)',
    example: '30',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxShortExposurePct?: string | null;

  @ApiPropertyOptional({
    description: 'Max single short position as % of equity (null to clear)',
    example: '10',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumberString()
  maxSingleShortPct?: string | null;
}

export class RiskEventsQueryDto {
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
}
