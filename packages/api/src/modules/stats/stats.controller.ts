import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DrizzleProvider } from '../database/drizzle.provider';
import { fills } from '../database/schema';
import { sql, gte } from 'drizzle-orm';
import { MasterKeyGuard } from '../../common/guards/master-key.guard';
import { PriceMonitorService } from '../scheduler/price-monitor.service';

@ApiTags('Stats')
@Controller('stats')
@SkipThrottle()
export class StatsController {
  constructor(
    private readonly drizzle: DrizzleProvider,
    private readonly priceMonitor: PriceMonitorService,
  ) {}

  @Get('activity')
  @ApiOperation({ summary: 'Get trading activity over time' })
  @ApiQuery({ name: 'days', description: 'Number of days to look back (default 30)', required: false })
  @ApiResponse({ status: 200, description: 'Activity data returned' })
  async getActivity(@Query('days') daysParam?: string) {
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.drizzle.db
      .select({
        date: sql<string>`DATE(${fills.filledAt})`.as('date'),
        tradeCount: sql<number>`COUNT(*)::int`.as('trade_count'),
      })
      .from(fills)
      .where(gte(fills.filledAt, since))
      .groupBy(sql`DATE(${fills.filledAt})`)
      .orderBy(sql`DATE(${fills.filledAt})`);

    return rows;
  }

  @Post('fill-pending')
  @UseGuards(MasterKeyGuard)
  @ApiOperation({ summary: 'Trigger fill of pending/queued orders' })
  @ApiSecurity('master-key')
  @ApiResponse({ status: 201, description: 'Pending orders processed' })
  async fillPending() {
    await this.priceMonitor.fillQueuedMarketOrders();
    await this.priceMonitor.evaluatePendingOrders();
    return { ok: true };
  }
}
