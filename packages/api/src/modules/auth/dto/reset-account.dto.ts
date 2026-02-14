import { IsNumberString, IsOptional } from 'class-validator';

export class ResetAccountDto {
  @IsOptional()
  @IsNumberString()
  startingBalance?: string;
}
