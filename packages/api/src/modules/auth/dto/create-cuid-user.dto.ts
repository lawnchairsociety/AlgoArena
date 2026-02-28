import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCuidUserDto {
  @ApiPropertyOptional({ description: 'Optional label for the user', maxLength: 100, example: 'my-agent' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ description: 'Starting balance for the account', example: '10000' })
  @IsOptional()
  @IsNumberString()
  startingBalance?: string;

  @ApiPropertyOptional({ description: 'Enforce pattern day trader rule', default: true, example: true })
  @IsOptional()
  @IsBoolean()
  pdtEnforced?: boolean;
}
