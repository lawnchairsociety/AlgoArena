import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;
}
