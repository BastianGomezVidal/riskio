import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../auth.roles.js';

const PHONE_PATTERN = /^[+()0-9\s.-]{6,20}$/;

/** Credentials for logging in with email and password. */
export class CredentialsDto {
  @ApiProperty({ description: 'Login email', example: 'operator@riskio.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', minLength: 8 })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 0,
    minUppercase: 0,
    minNumbers: 0,
    minSymbols: 0,
  })
  password: string;
}

/** Profile fields collected when registering a new account. */
export class RegisterDto {
  @ApiProperty({ description: 'First name', example: 'Ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Lovelace' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1 555 010 1234',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, {
    message: 'phone must be 6-20 characters, digits, +, (), space, . or -',
  })
  phone?: string;

  @ApiProperty({ description: 'Login email', example: 'ada@riskio.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password (min 8 chars)', minLength: 8 })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 0,
    minUppercase: 0,
    minNumbers: 0,
    minSymbols: 0,
  })
  password: string;
}

/** Authenticated session: a JWT access token plus the user summary. */
export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'Authenticated user' })
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}