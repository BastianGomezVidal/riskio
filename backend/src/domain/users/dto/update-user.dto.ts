import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PHONE_PATTERN = /^[+()0-9\s.-]{6,20}$/;

/**
 * Fields a user can update on their own profile.
 *
 * Email is intentionally NOT included here — changing it requires a
 * verification round-trip and lives in its own endpoint (Phase 7, Commit C).
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Ada' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Lovelace' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

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
}
