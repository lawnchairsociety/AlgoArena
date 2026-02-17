import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { TradingModule } from '../trading/trading.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

@Module({
  imports: [MarketDataModule, TradingModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioAnalyticsService],
  exports: [PortfolioService, PortfolioAnalyticsService],
})
export class PortfolioModule {}
