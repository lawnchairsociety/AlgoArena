import { ORDER_SIDES, ORDER_TYPES, OrderSide, OrderType, TIME_IN_FORCE_VALUES, TimeInForce } from '@algoarena/shared';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class TakeProfitDto {
  @IsNumberString()
  limitPrice!: string;
}

export class StopLossDto {
  @IsNumberString()
  stopPrice!: string;

  @IsOptional()
  @IsNumberString()
  limitPrice?: string;
}

export class BracketDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TakeProfitDto)
  takeProfit?: TakeProfitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StopLossDto)
  stopLoss?: StopLossDto;
}

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsIn([...ORDER_SIDES])
  side!: OrderSide;

  @IsIn([...ORDER_TYPES])
  type!: OrderType;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  limitPrice?: string;

  @IsOptional()
  @IsNumberString()
  stopPrice?: string;

  @IsOptional()
  @IsNumberString()
  trailPercent?: string;

  @IsOptional()
  @IsNumberString()
  trailPrice?: string;

  @IsIn([...TIME_IN_FORCE_VALUES])
  timeInForce!: TimeInForce;

  @IsOptional()
  @ValidateNested()
  @Type(() => BracketDto)
  bracket?: BracketDto;

  @IsOptional()
  @IsUUID()
  ocoLinkedTo?: string;
}
