import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import {
  ORDER_SIDES,
  ORDER_TYPES,
  TIME_IN_FORCE_VALUES,
  type OrderSide,
  type OrderType,
  type TimeInForce,
} from '@algoarena/shared';

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

  @IsIn([...TIME_IN_FORCE_VALUES])
  timeInForce!: TimeInForce;
}
