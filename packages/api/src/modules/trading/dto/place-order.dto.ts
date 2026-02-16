import { ORDER_SIDES, ORDER_TYPES, OrderSide, OrderType, TIME_IN_FORCE_VALUES, TimeInForce } from '@algoarena/shared';
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

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
}
