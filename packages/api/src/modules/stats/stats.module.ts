import { Module } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [SchedulerModule],
  controllers: [StatsController],
})
export class StatsModule {}
