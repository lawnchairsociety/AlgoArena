import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CuidUser } from '../../common/decorators/cuid-user.decorator';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { AnalyticsQueryDto, EnhancedTradeHistoryQueryDto, HistoryQueryDto } from './dto/portfolio-query.dto';
import { PortfolioService } from './portfolio.service';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

@ApiTags('Portfolio')
@Controller('portfolio')
@UseGuards(CuidGuard)
@ApiSecurity('cuid')
@Throttle({ default: { ttl: 60000, limit: 60 } })
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly analyticsService: PortfolioAnalyticsService,
  ) {}

  @Get('account')
  @ApiOperation({ summary: 'Get account summary' })
  @ApiResponse({ status: 200, description: 'Account summary returned' })
  async getAccountSummary(@CuidUser() user: CuidUserRecord) {
    return this.portfolioService.getAccountSummary(user.id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get portfolio analytics' })
  @ApiQuery({ name: 'period', required: false, description: 'Analytics period (7d, 30d, 90d, ytd, 1y, all)' })
  @ApiQuery({ name: 'benchmark', required: false, description: 'Benchmark symbol (default: SPY)' })
  @ApiResponse({ status: 200, description: 'Analytics returned' })
  async getAnalytics(@CuidUser() user: CuidUserRecord, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAnalytics(user.id, query.period ?? 'all', query.benchmark ?? 'SPY');
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
  @ApiQuery({ name: 'period', required: false, description: 'History period (7d, 30d, 90d, ytd, 1y, all)' })
  @ApiResponse({ status: 200, description: 'History returned' })
  async getPortfolioHistory(@CuidUser() user: CuidUserRecord, @Query() query: HistoryQueryDto) {
    return this.analyticsService.getHistory(user.id, query.period ?? '30d');
  }

  @Get('trades')
  @ApiOperation({ summary: 'Get enhanced trade history' })
  @ApiQuery({ name: 'symbol', required: false, description: 'Filter by symbol' })
  @ApiQuery({ name: 'side', required: false, description: 'Filter by side (buy, sell)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-500, default 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Enhanced trade history returned' })
  async getTradeHistory(@CuidUser() user: CuidUserRecord, @Query() query: EnhancedTradeHistoryQueryDto) {
    return this.analyticsService.getTrades(user.id, query);
  }
}
