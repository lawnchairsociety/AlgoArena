import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ description: 'Optional label for the API key', maxLength: 100, example: 'my-bot' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
