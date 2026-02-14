import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketDataModule } from '../market-data/market-data.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { TradingModule } from '../trading/trading.module';
import { PriceMonitorService } from './price-monitor.service';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), MarketDataModule, TradingModule, PortfolioModule],
  providers: [SchedulerService, PriceMonitorService],
  exports: [PriceMonitorService],
})
export class SchedulerModule {}
