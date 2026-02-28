import { ORDER_SIDES, ORDER_TYPES, OrderSide, OrderType, TIME_IN_FORCE_VALUES, TimeInForce } from '@algoarena/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class TakeProfitDto {
  @ApiProperty({ description: 'Take profit limit price', example: '155.00' })
  @IsNumberString()
  limitPrice!: string;
}

export class StopLossDto {
  @ApiProperty({ description: 'Stop loss trigger price', example: '145.00' })
  @IsNumberString()
  stopPrice!: string;

  @ApiPropertyOptional({ description: 'Stop loss limit price (for stop-limit)', example: '144.50' })
  @IsOptional()
  @IsNumberString()
  limitPrice?: string;
}

export class BracketDto {
  @ApiPropertyOptional({ description: 'Take profit leg', type: TakeProfitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TakeProfitDto)
  takeProfit?: TakeProfitDto;

  @ApiPropertyOptional({ description: 'Stop loss leg', type: StopLossDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StopLossDto)
  stopLoss?: StopLossDto;
}

export class LegDto {
  @ApiProperty({ description: 'Option or asset symbol', example: 'SPY250321C00550000' })
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @ApiProperty({ description: 'Order side', enum: [...ORDER_SIDES] })
  @IsIn([...ORDER_SIDES])
  side!: OrderSide;

  @ApiProperty({ description: 'Quantity', example: '1' })
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ description: 'Order type', enum: ['market', 'limit'] })
  @IsIn(['market', 'limit'])
  type!: string;
}

export class PlaceOrderDto {
  @ApiProperty({ description: 'Symbol to trade', example: 'AAPL' })
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @ApiProperty({ description: 'Order side', enum: [...ORDER_SIDES] })
  @IsIn([...ORDER_SIDES])
  side!: OrderSide;

  @ApiProperty({ description: 'Order type', enum: [...ORDER_TYPES] })
  @IsIn([...ORDER_TYPES])
  type!: OrderType;

  @ApiProperty({ description: 'Order quantity', example: '10' })
  @IsNumberString()
  quantity!: string;

  @ApiPropertyOptional({ description: 'Limit price (required for limit/stop-limit orders)', example: '150.00' })
  @IsOptional()
  @IsNumberString()
  limitPrice?: string;

  @ApiPropertyOptional({ description: 'Stop price (required for stop/stop-limit orders)', example: '145.00' })
  @IsOptional()
  @IsNumberString()
  stopPrice?: string;

  @ApiPropertyOptional({ description: 'Trail percent (for trailing stop orders)', example: '3.0' })
  @IsOptional()
  @IsNumberString()
  trailPercent?: string;

  @ApiPropertyOptional({ description: 'Trail price (for trailing stop orders)', example: '5.00' })
  @IsOptional()
  @IsNumberString()
  trailPrice?: string;

  @ApiProperty({ description: 'Time in force', enum: [...TIME_IN_FORCE_VALUES] })
  @IsIn([...TIME_IN_FORCE_VALUES])
  timeInForce!: TimeInForce;

  @ApiPropertyOptional({ description: 'Bracket order (take profit and/or stop loss)', type: BracketDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BracketDto)
  bracket?: BracketDto;

  @ApiPropertyOptional({ description: 'Link to another order as OCO pair' })
  @IsOptional()
  @IsUUID()
  ocoLinkedTo?: string;

  @ApiPropertyOptional({ description: 'Multi-leg order legs', type: [LegDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegDto)
  legs?: LegDto[];

  @ApiPropertyOptional({ description: 'Order class', enum: ['simple', 'multileg'] })
  @IsOptional()
  @IsIn(['simple', 'multileg'])
  orderClass?: string;

  @ApiPropertyOptional({ description: 'Allow extended hours trading', example: false })
  @IsOptional()
  @IsBoolean()
  extendedHours?: boolean;
}
