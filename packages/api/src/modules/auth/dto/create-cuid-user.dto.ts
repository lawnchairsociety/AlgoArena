import { IsBoolean, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCuidUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumberString()
  startingBalance?: string;

  @IsOptional()
  @IsBoolean()
  pdtEnforced?: boolean;
}
