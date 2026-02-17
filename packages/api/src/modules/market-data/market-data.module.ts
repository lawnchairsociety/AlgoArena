import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlpacaClientService } from './alpaca-client.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataProvider } from './market-data.provider';
import { MarketDataService } from './market-data.service';
import { SessionService } from './session.service';

// biome-ignore lint/suspicious/noExplicitAny: generic constructor type for provider registry
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
          throw new Error(`Unknown MARKET_DATA_PROVIDER "${name}". Available: ${available}`);
        }
        new Logger('MarketDataModule').log(`Using market data provider: ${name}`);
        return new ProviderClass(configService);
      },
      inject: [ConfigService],
    },
    MarketDataService,
    SessionService,
  ],
  exports: [MarketDataProvider, MarketDataService, SessionService],
})
export class MarketDataModule {}
