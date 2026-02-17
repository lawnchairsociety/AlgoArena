import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { OptionsMarginService } from './options-margin.service';
import { OrderEngineService } from './order-engine.service';
import { PdtService } from './pdt.service';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
  imports: [MarketDataModule],
  controllers: [TradingController],
  providers: [TradingService, OrderEngineService, PdtService, OptionsMarginService],
  exports: [TradingService, OrderEngineService, PdtService, OptionsMarginService],
})
export class TradingModule {}
