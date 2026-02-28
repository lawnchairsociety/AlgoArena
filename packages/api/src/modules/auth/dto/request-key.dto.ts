import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestKeyDto {
  @ApiProperty({ description: 'Your name', minLength: 1, maxLength: 100, example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Your email address', maxLength: 255, example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
