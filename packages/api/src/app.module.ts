import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { TradingModule } from './modules/trading/trading.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { StatsModule } from './modules/stats/stats.module';
import { ThrottleValkeyStorage } from './common/throttle/throttle-valkey.storage';
import { CuidThrottlerGuard } from './common/throttle/cuid-throttler.guard';
import { HealthController } from './modules/health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    AppConfigModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'market', ttl: 60000, limit: 120 },
        { name: 'trading', ttl: 60000, limit: 30 },
        { name: 'portfolio', ttl: 60000, limit: 60 },
      ],
    }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    MarketDataModule,
    TradingModule,
    PortfolioModule,
    SchedulerModule,
    WebSocketModule,
    StatsModule,
  ],
  providers: [
    ThrottleValkeyStorage,
    {
      provide: ThrottlerStorage,
      useExisting: ThrottleValkeyStorage,
    },
    {
      provide: APP_GUARD,
      useClass: CuidThrottlerGuard,
    },
  ],
})
export class AppModule {}
