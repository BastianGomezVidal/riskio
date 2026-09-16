// src/auth/dto/forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Email of the account whose password should be reset. */
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Login email of the account to reset',
    example: 'operator@riskio.dev',
  })
  @IsEmail()
  email: string;
}

/**
 * Result of a password reset.
 *
 * The response is intentionally identical whether or not the email exists,
 * to prevent user enumeration. The temporary password is never returned in
 * the body: it is delivered out of band (email in production, backend log
 * in development).
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description:
      'Neutral message. Does not confirm or deny that the email exists.',
    example:
      'If an account exists for that email, a temporary password has been sent.',
  })
  message: string;
}
