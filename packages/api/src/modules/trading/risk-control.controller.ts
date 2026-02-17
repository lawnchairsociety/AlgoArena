import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CuidUser } from '../../common/decorators/cuid-user.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { RiskEventsQueryDto, UpdateRiskControlsDto } from './dto/risk-control.dto';
import { RiskControlService } from './risk-control.service';

@ApiTags('Risk Controls')
@Controller('trading/risk-controls')
@Throttle({ default: { ttl: 60000, limit: 30 } })
export class RiskControlController {
  constructor(private readonly riskControlService: RiskControlService) {}

  @Get()
  @UseGuards(CuidGuard)
  @ApiOperation({ summary: 'Get risk controls and current status' })
  @ApiSecurity('cuid')
  @ApiResponse({ status: 200, description: 'Risk controls with live status' })
  async getControls(@CuidUser() user: CuidUserRecord) {
    return this.riskControlService.getControlsWithStatus(user.id);
  }

  @Put()
  @UseGuards(ApiKeyGuard, CuidGuard)
  @ApiOperation({ summary: 'Update risk controls' })
  @ApiSecurity('api-key')
  @ApiSecurity('cuid')
  @ApiResponse({ status: 200, description: 'Controls updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async updateControls(@CuidUser() user: CuidUserRecord, @Body() dto: UpdateRiskControlsDto) {
    return this.riskControlService.updateControls(user.id, dto);
  }

  @Get('events')
  @UseGuards(CuidGuard)
  @ApiOperation({ summary: 'Get risk control events' })
  @ApiSecurity('cuid')
  @ApiResponse({ status: 200, description: 'Risk events returned' })
  async getEvents(@CuidUser() user: CuidUserRecord, @Query() query: RiskEventsQueryDto) {
    return this.riskControlService.getEvents(user.id, query);
  }
}
