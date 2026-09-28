import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  HttpCode,
  HttpStatus,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  CredentialsDto,
  RegisterDto,
  AuthResponseDto,
} from './dto/credentials.dto.js';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from './dto/forgot-password.dto.js';
import {
  CreateApiTokenDto,
  CreatedApiTokenDto,
} from './dto/create-api-token.dto.js';
import { ApiToken } from './entities/api-token.entity.js';
import { ApiTokenDto } from './dto/api-token.dto.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import type { AuthPrincipal } from './auth.roles.js';
import { OAuthProviderName } from './oauth/oauth.service.js';

/**
 * Account registration, login, Google/Outlook sign-in and machine
 * API-token management.
 *
 * All routes are protected by JwtAuthGuard (registered globally). The
 * `@Public()` decorator opts a route out of authentication.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  @ApiCreatedResponse({ description: 'Session for the new account' })
  @ApiUnauthorizedResponse({ description: 'Email already registered' })
  register(@Body() body: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone ?? null,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and obtain an access token' })
  @ApiOkResponse({ description: 'JWT access token' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() credentials: CredentialsDto): Promise<AuthResponseDto> {
    return this.auth.login(credentials.email, credentials.password);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  /**
   * Documented as what it does, which is not what it used to do. It used to
   * write a temporary password onto the account and return it in the response;
   * it now mails a single-use reset link. The old text was not a leftover, it
   * described a behaviour that had been removed, and an API client built from
   * this document would have waited for a password that never arrived.
   */
  @ApiOperation({
    summary: 'Email a single-use password reset link',
    description:
      'Always returns 200, whether or not the address is registered, so the ' +
      'endpoint cannot be used to enumerate accounts. In local development the ' +
      'link is written to the log instead of being mailed (MAIL_TRANSPORT=log).',
  })
  @ApiOkResponse({
    description:
      'Accepted. Whether a link was actually sent is never disclosed.',
    type: ForgotPasswordResponseDto,
  })
  @ApiNotFoundResponse({ description: 'No account matches the email' })
  @ApiBadRequestResponse({ description: 'OAuth-only account has no password' })
  forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset link' })
  @ApiOkResponse({
    description: 'The token was accepted and the password was replaced',
    type: ResetPasswordResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Unknown, already-used or expired token',
  })
  resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    return this.auth.resetPasswordWithToken(body.token, body.newPassword);
  }

  @Public()
  @Get('oauth/:provider')
  @ApiOperation({ summary: 'Start Google/Outlook sign-in (browser redirect)' })
  @ApiParam({
    name: 'provider',
    enum: ['google', 'outlook'],
    description: 'google or outlook',
  })
  @ApiProduces('text/html')
  oauthStart(
    @Param('provider', new ParseEnumPipe(OAuthProviderName))
    provider: OAuthProviderName,
    @Res() response: Response,
  ): void {
    response.redirect(this.auth.oauthAuthorizeUrl(provider));
  }

  @Public()
  @Get('oauth/:provider/callback')
  @ApiOperation({ summary: 'OAuth callback, redirects with a session token' })
  @ApiParam({
    name: 'provider',
    enum: ['google', 'outlook'],
    description: 'google or outlook',
  })
  @ApiProduces('text/html')
  async oauthCallback(
    @Param('provider', new ParseEnumPipe(OAuthProviderName))
    provider: OAuthProviderName,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    try {
      if (!code || !state) {
        throw new Error('Missing OAuth code or state');
      }

      const session = await this.auth.oauthCallback(provider, code, state);
      response.redirect(
        this.buildFrontendCallbackUrl('token', session.accessToken),
      );
    } catch {
      response.redirect(this.buildFrontendCallbackUrl('error', 'oauth_failed'));
    }
  }

  @Post('tokens')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a machine API token' })
  @ApiCreatedResponse({ description: 'New API token (shown once)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  createToken(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: CreateApiTokenDto,
  ): Promise<CreatedApiTokenDto> {
    return this.auth.createApiToken(user.id, body.name);
  }

  @Get('tokens')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current account API tokens' })
  @ApiOkResponse({ description: 'Active tokens (metadata only)', type: [ApiTokenDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  listTokens(@CurrentUser() user: AuthPrincipal): Promise<ApiTokenDto[]> {
    return this.auth.listApiTokens(user.id);
  }

  @Delete('tokens/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API token' })
  @ApiParam({ name: 'id', description: 'API token UUID', format: 'uuid' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async revokeToken(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.auth.revokeApiToken(user.id, id);
  }

  /**
   * Landing page the frontend must handle after an OAuth round-trip.
   * `?token=...` carries the session on success, `?error=...` on failure.
   */
  private buildFrontendCallbackUrl(
    key: 'token' | 'error',
    value: string,
  ): string {
    const base = this.auth.frontendBaseUrl();
    return `${base}/auth/callback?${key}=${encodeURIComponent(value)}`;
  }
}
