import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataProvider } from './market-data.provider';
import { AlpacaClientService } from './alpaca-client.service';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';

const PROVIDERS: Record<string, new (...args: any[]) => MarketDataProvider> = {
  alpaca: AlpacaClientService,
};

@Module({
  controllers: [MarketDataController],
  providers: [
    {
      provide: MarketDataProvider,
      useFactory: (configService: ConfigService) => {
        const name = configService.get<string>('MARKET_DATA_PROVIDER', 'alpaca');
        const ProviderClass = PROVIDERS[name];
        if (!ProviderClass) {
          const available = Object.keys(PROVIDERS).join(', ');
          throw new Error(
            `Unknown MARKET_DATA_PROVIDER "${name}". Available: ${available}`,
          );
        }
        new Logger('MarketDataModule').log(`Using market data provider: ${name}`);
        return new ProviderClass(configService);
      },
      inject: [ConfigService],
    },
    MarketDataService,
  ],
  exports: [MarketDataProvider, MarketDataService],
})
export class MarketDataModule {}
