import { isOptionSymbol } from '@algoarena/shared';
import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { MarketDataService } from './market-data.service';

@ApiTags('Market Data')
@Controller('market')
@UseGuards(CuidGuard)
@ApiSecurity('cuid')
@Throttle({ default: { ttl: 60000, limit: 120 } })
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get('quotes')
  @ApiOperation({ summary: 'Get quotes for multiple symbols' })
  @ApiQuery({ name: 'symbols', description: 'Comma-separated list of symbols', required: true })
  @ApiResponse({ status: 200, description: 'Quotes returned' })
  async getQuotes(@Query('symbols') symbols?: string) {
    if (!symbols) {
      throw new BadRequestException('symbols query parameter is required');
    }
    const list = symbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      throw new BadRequestException('At least one symbol is required');
    }
    return this.marketData.getQuotes(list);
  }

  @Get('quotes/:symbol')
  @ApiOperation({ summary: 'Get a quote for a single symbol' })
  @ApiParam({ name: 'symbol', description: 'Stock symbol' })
  @ApiResponse({ status: 200, description: 'Quote returned' })
  async getQuote(@Param('symbol') symbol: string) {
    return this.marketData.getQuote(symbol);
  }

  @Get('bars')
  @ApiOperation({ summary: 'Get historical bars for multiple symbols' })
  @ApiQuery({ name: 'symbols', description: 'Comma-separated list of symbols (max 100)', required: true })
  @ApiQuery({ name: 'timeframe', description: 'Bar timeframe (e.g. 1Day)', required: true })
  @ApiQuery({ name: 'start', description: 'Start date (ISO 8601)', required: false })
  @ApiQuery({ name: 'end', description: 'End date (ISO 8601)', required: false })
  @ApiQuery({ name: 'limit', description: 'Number of bars per symbol (max 1000)', required: false })
  @ApiResponse({ status: 200, description: 'Bars returned' })
  async getMultiBars(
    @Query('symbols') symbols?: string,
    @Query('timeframe') timeframe?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    if (!symbols) {
      throw new BadRequestException('symbols query parameter is required');
    }
    if (!timeframe) {
      throw new BadRequestException('timeframe query parameter is required');
    }
    const list = symbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      throw new BadRequestException('At least one symbol is required');
    }
    if (list.length > 100) {
      throw new BadRequestException('Maximum 100 symbols allowed');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    if (parsedLimit !== undefined && parsedLimit > 1000) {
      throw new BadRequestException('Maximum limit is 1000');
    }
    return this.marketData.getMultiBars(list, {
      timeframe,
      start,
      end,
      limit: parsedLimit,
    });
  }

  @Get('bars/:symbol')
  @ApiOperation({ summary: 'Get historical bars for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Stock symbol' })
  @ApiQuery({ name: 'timeframe', description: 'Bar timeframe (e.g. 1Day)', required: true })
  @ApiQuery({ name: 'start', description: 'Start date (ISO 8601)', required: false })
  @ApiQuery({ name: 'end', description: 'End date (ISO 8601)', required: false })
  @ApiQuery({ name: 'limit', description: 'Number of bars', required: false })
  @ApiResponse({ status: 200, description: 'Bars returned' })
  async getBars(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    if (!timeframe) {
      throw new BadRequestException('timeframe query parameter is required');
    }
    return this.marketData.getBars(symbol, {
      timeframe,
      start,
      end,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('snapshots/:symbol')
  @ApiOperation({ summary: 'Get a market snapshot for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Stock symbol' })
  @ApiResponse({ status: 200, description: 'Snapshot returned' })
  async getSnapshot(@Param('symbol') symbol: string) {
    return this.marketData.getSnapshot(symbol);
  }

  @Get('clock')
  @ApiOperation({ summary: 'Get current market clock' })
  @ApiQuery({ name: 'class', description: 'Asset class (us_equity or crypto)', required: false })
  @ApiResponse({ status: 200, description: 'Market clock returned' })
  async getClock(@Query('class') assetClass?: string) {
    if (assetClass === 'crypto') {
      return { timestamp: new Date().toISOString(), isOpen: true, nextOpen: null, nextClose: null };
    }
    return this.marketData.getClock();
  }

  @Get('assets')
  @ApiOperation({ summary: 'List tradeable assets' })
  @ApiQuery({ name: 'status', description: 'Filter by status (e.g. active)', required: false })
  @ApiQuery({ name: 'asset_class', description: 'Filter by asset class (e.g. us_equity)', required: false })
  @ApiResponse({ status: 200, description: 'Assets returned' })
  async getAssets(@Query('status') status?: string, @Query('asset_class') assetClass?: string) {
    return this.marketData.getAssets({
      status: status || undefined,
      asset_class: assetClass || undefined,
    });
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get market calendar' })
  @ApiQuery({ name: 'start', description: 'Start date (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'end', description: 'End date (YYYY-MM-DD)', required: false })
  @ApiResponse({ status: 200, description: 'Calendar returned' })
  async getCalendar(@Query('start') start?: string, @Query('end') end?: string) {
    return this.marketData.getCalendar({
      start: start || undefined,
      end: end || undefined,
    });
  }

  // ── Options ──

  @Get('options/chain/:symbol')
  @ApiOperation({ summary: 'Get option chain for an underlying symbol' })
  @ApiParam({ name: 'symbol', description: 'Underlying stock symbol (e.g. AAPL)' })
  @ApiQuery({ name: 'expiration', description: 'Filter by expiration date (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'type', description: 'Filter by option type (call or put)', required: false })
  @ApiQuery({ name: 'strike_price_gte', description: 'Minimum strike price', required: false })
  @ApiQuery({ name: 'strike_price_lte', description: 'Maximum strike price', required: false })
  @ApiResponse({ status: 200, description: 'Option chain returned' })
  async getOptionChain(
    @Param('symbol') symbol: string,
    @Query('expiration') expiration?: string,
    @Query('type') type?: string,
    @Query('strike_price_gte') strikePriceGte?: string,
    @Query('strike_price_lte') strikePriceLte?: string,
  ) {
    return this.marketData.getOptionChain(symbol, {
      expiration: expiration || undefined,
      type: type || undefined,
      strike_price_gte: strikePriceGte || undefined,
      strike_price_lte: strikePriceLte || undefined,
    });
  }

  @Get('options/quotes/:contractSymbol')
  @ApiOperation({ summary: 'Get quote for an option contract' })
  @ApiParam({ name: 'contractSymbol', description: 'OCC option symbol (e.g. AAPL260320C00230000)' })
  @ApiResponse({ status: 200, description: 'Option quote returned' })
  async getOptionQuote(@Param('contractSymbol') contractSymbol: string) {
    if (!isOptionSymbol(contractSymbol)) {
      throw new BadRequestException(`Invalid OCC option symbol: ${contractSymbol}`);
    }
    const quotes = await this.marketData.getOptionQuotes([contractSymbol.toUpperCase()]);
    const quote = quotes[contractSymbol.toUpperCase()];
    if (!quote) {
      throw new BadRequestException(`No quote found for ${contractSymbol}`);
    }
    return quote;
  }

  @Get('options/expirations/:symbol')
  @ApiOperation({ summary: 'Get available expiration dates for an underlying symbol' })
  @ApiParam({ name: 'symbol', description: 'Underlying stock symbol (e.g. AAPL)' })
  @ApiResponse({ status: 200, description: 'Expirations returned' })
  async getOptionExpirations(@Param('symbol') symbol: string) {
    const expirations = await this.marketData.getOptionExpirations(symbol);
    return { symbol: symbol.toUpperCase(), expirations };
  }
}
