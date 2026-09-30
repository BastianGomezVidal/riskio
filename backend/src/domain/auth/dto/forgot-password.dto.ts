// src/auth/dto/forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

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
 * Result of a password reset request.
 *
 * The response is intentionally identical whether or not the email exists,
 * to prevent user enumeration. The reset link is never returned in the body:
 * it is delivered out of band.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description:
      'Neutral message. Does not confirm or deny that the email exists.',
    example:
      'If that account exists, a link to set a new password has been sent.',
  })
  message: string;
}

/** Redeems a reset link with the password the user wants from now on. */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'The token from the emailed link',
    example: 'k3Jd0fH2sa91',
  })
  @IsString()
  token: string;

  @ApiProperty({ description: 'The new password', minLength: 4 })
  @IsString()
  @IsStrongPassword({
    minLength: 4,
    minLowercase: 0,
    minUppercase: 0,
    minNumbers: 0,
    minSymbols: 0,
  })
  newPassword: string;
}

/** Confirmation that a reset link was accepted. */
export class ResetPasswordResponseDto {
  @ApiProperty({
    description:
      'Neutral message. Does not confirm or deny that the email exists.',
    example: 'Password updated. You can sign in now.',
  })
  message: string;
}
