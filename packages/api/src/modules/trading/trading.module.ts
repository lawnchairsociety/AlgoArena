import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { OptionsMarginService } from './options-margin.service';
import { OrderEngineService } from './order-engine.service';
import { PdtService } from './pdt.service';
import { RiskControlController } from './risk-control.controller';
import { RiskControlService } from './risk-control.service';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
  imports: [MarketDataModule],
  controllers: [TradingController, RiskControlController],
  providers: [TradingService, OrderEngineService, PdtService, OptionsMarginService, RiskControlService],
  exports: [TradingService, OrderEngineService, PdtService, OptionsMarginService, RiskControlService],
})
export class TradingModule {}
