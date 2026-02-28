import { ORDER_STATUSES, OrderStatus } from '@algoarena/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by order status', enum: [...ORDER_STATUSES] })
  @IsOptional()
  @IsIn([...ORDER_STATUSES])
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filter by symbol', example: 'AAPL' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ description: 'Max number of results', minimum: 1, maximum: 100, default: 50, example: 50 })
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
