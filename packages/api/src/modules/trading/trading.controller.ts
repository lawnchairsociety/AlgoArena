import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { CuidUser } from '../../common/decorators/cuid-user.decorator';
import type { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { TradingService } from './trading.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@ApiTags('Trading')
@Controller('trading')
@SkipThrottle()
@Throttle({ trading: { ttl: 60000, limit: 30 } })
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('orders')
  @UseGuards(ApiKeyGuard, CuidGuard)
  @ApiOperation({ summary: 'Place a new order' })
  @ApiSecurity('api-key')
  @ApiSecurity('cuid')
  @ApiResponse({ status: 201, description: 'Order placed' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async placeOrder(
    @CuidUser() user: CuidUserRecord,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.tradingService.placeOrder(user.id, dto);
  }

  @Delete('orders/:id')
  @UseGuards(ApiKeyGuard, CuidGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiSecurity('api-key')
  @ApiSecurity('cuid')
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  async cancelOrder(
    @CuidUser() user: CuidUserRecord,
    @Param('id') orderId: string,
  ) {
    return this.tradingService.cancelOrder(orderId, user.id);
  }

  @Get('orders')
  @UseGuards(CuidGuard)
  @ApiOperation({ summary: 'List orders' })
  @ApiSecurity('cuid')
  @ApiResponse({ status: 200, description: 'Orders returned' })
  async listOrders(
    @CuidUser() user: CuidUserRecord,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.tradingService.listOrders(user.id, query);
  }

  @Get('orders/:id')
  @UseGuards(CuidGuard)
  @ApiOperation({ summary: 'Get a single order with fills' })
  @ApiSecurity('cuid')
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order returned' })
  async getOrder(
    @CuidUser() user: CuidUserRecord,
    @Param('id') orderId: string,
  ) {
    return this.tradingService.getOrder(orderId, user.id);
  }
}
