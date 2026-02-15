import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CuidUser } from '../../common/decorators/cuid-user.decorator';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { PortfolioHistoryQueryDto, TradeHistoryQueryDto } from './dto/portfolio-query.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('Portfolio')
@Controller('portfolio')
@UseGuards(CuidGuard)
@ApiSecurity('cuid')
@Throttle({ default: { ttl: 60000, limit: 60 } })
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('account')
  @ApiOperation({ summary: 'Get account summary' })
  @ApiResponse({ status: 200, description: 'Account summary returned' })
  async getAccountSummary(@CuidUser() user: CuidUserRecord) {
    return this.portfolioService.getAccountSummary(user.id);
  }

  @Get('positions')
  @ApiOperation({ summary: 'List all open positions' })
  @ApiResponse({ status: 200, description: 'Positions returned' })
  async getPositions(@CuidUser() user: CuidUserRecord) {
    return this.portfolioService.getPositions(user.id);
  }

  @Get('positions/:symbol')
  @ApiOperation({ summary: 'Get position for a specific symbol' })
  @ApiParam({ name: 'symbol', description: 'Stock symbol' })
  @ApiResponse({ status: 200, description: 'Position returned' })
  async getPositionBySymbol(@CuidUser() user: CuidUserRecord, @Param('symbol') symbol: string) {
    return this.portfolioService.getPositionBySymbol(user.id, symbol);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get portfolio value history' })
  @ApiResponse({ status: 200, description: 'History returned' })
  async getPortfolioHistory(@CuidUser() user: CuidUserRecord, @Query() query: PortfolioHistoryQueryDto) {
    const days = query.days ?? 30;
    return this.portfolioService.getPortfolioHistory(user.id, days);
  }

  @Get('trades')
  @ApiOperation({ summary: 'Get trade history' })
  @ApiResponse({ status: 200, description: 'Trade history returned' })
  async getTradeHistory(@CuidUser() user: CuidUserRecord, @Query() query: TradeHistoryQueryDto) {
    return this.portfolioService.getTradeHistory(user.id, query);
  }
}
