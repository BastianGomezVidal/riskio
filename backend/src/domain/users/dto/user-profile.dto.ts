import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '../../auth/auth.roles.js';

/**
 * Canonical user shape returned by every endpoint that exposes a user:
 * login, register, GET /users/me, PATCH /users/me.
 *
 * Keeping a single DTO avoids drift between the auth and users modules.
 */
export class UserProfileDto {
  @ApiProperty({ description: 'User UUID' })
  id: string;

  @ApiProperty({ description: 'Login email' })
  email: string;

  @ApiProperty({ description: 'Account role', example: 'client' })
  role: Role;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Phone number', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ description: 'When the account was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the account was last updated' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last login timestamp', nullable: true })
  lastLoginAt: string | null;

  @ApiPropertyOptional({ description: 'Last login browser', nullable: true })
  lastLoginBrowser: string | null;

  @ApiPropertyOptional({ description: 'Last login OS', nullable: true })
  lastLoginOs: string | null;
}
