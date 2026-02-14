import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { OrderEngineService } from './order-engine.service';
import { PdtService } from './pdt.service';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
  imports: [MarketDataModule],
  controllers: [TradingController],
  providers: [TradingService, OrderEngineService, PdtService],
  exports: [TradingService, OrderEngineService, PdtService],
})
export class TradingModule {}
