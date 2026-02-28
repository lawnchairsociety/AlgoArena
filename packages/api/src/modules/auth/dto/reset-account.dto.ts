import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';

export class ResetAccountDto {
  @ApiPropertyOptional({ description: 'Starting balance to reset to', example: '100000' })
  @IsOptional()
  @IsNumberString()
  startingBalance?: string;
}
