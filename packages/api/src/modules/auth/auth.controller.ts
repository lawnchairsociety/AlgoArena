import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiKey } from '../../common/decorators/api-key.decorator';
import { CuidUser } from '../../common/decorators/cuid-user.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CuidGuard } from '../../common/guards/cuid.guard';
import { MasterKeyGuard } from '../../common/guards/master-key.guard';
import { ApiKeyRecord, CuidUserRecord } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateCuidUserDto } from './dto/create-cuid-user.dto';
import { RequestKeyDto } from './dto/request-key.dto';
import { ResetAccountDto } from './dto/reset-account.dto';

@ApiTags('Auth')
@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-key')
  @Throttle({ auth: { ttl: 900000, limit: 3 } })
  @ApiOperation({ summary: 'Request an API key' })
  @ApiResponse({ status: 201, description: 'Request submitted' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 503, description: 'Email notifications not configured' })
  async requestKey(@Body() dto: RequestKeyDto) {
    await this.authService.requestKey(dto);
    return { message: 'Your request has been submitted. You will receive an email when your API key is ready.' };
  }

  @Post('api-keys')
  @UseGuards(MasterKeyGuard)
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiSecurity('master-key')
  @ApiResponse({ status: 201, description: 'API key created' })
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.authService.generateApiKey(dto);
  }

  @Delete('api-keys/:id')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiSecurity('api-key')
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  async revokeApiKey(@Param('id') id: string) {
    await this.authService.revokeApiKey(id);
  }

  @Post('users')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'Create a new CUID user' })
  @ApiSecurity('api-key')
  @ApiResponse({ status: 201, description: 'User created' })
  async createUser(@ApiKey() apiKey: ApiKeyRecord, @Body() dto: CreateCuidUserDto) {
    return this.authService.createCuidUser(apiKey.id, dto);
  }

  @Post('users/:cuid/reset')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'Reset a user account' })
  @ApiSecurity('api-key')
  @ApiParam({ name: 'cuid', description: 'User CUID' })
  @ApiResponse({ status: 200, description: 'Account reset' })
  async resetAccount(@ApiKey() apiKey: ApiKeyRecord, @Param('cuid') cuid: string, @Body() dto: ResetAccountDto) {
    return this.authService.resetAccount(cuid, apiKey.id, dto);
  }

  @Get('users')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'List all users for an API key' })
  @ApiSecurity('api-key')
  @ApiResponse({ status: 200, description: 'List of users' })
  async listUsers(@ApiKey() apiKey: ApiKeyRecord) {
    return this.authService.listUsers(apiKey.id);
  }

  @Get('users/:cuid')
  @UseGuards(CuidGuard)
  @ApiOperation({ summary: 'Get current user info' })
  @ApiSecurity('cuid')
  @ApiParam({ name: 'cuid', description: 'User CUID' })
  @ApiResponse({ status: 200, description: 'User details' })
  async getUser(@CuidUser() user: CuidUserRecord) {
    return user;
  }
}
