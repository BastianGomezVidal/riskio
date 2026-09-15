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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
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
  CreateApiTokenDto,
  CreatedApiTokenDto,
} from './dto/create-api-token.dto.js';
import { ApiToken } from './entities/api-token.entity.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthPrincipal } from './auth.roles.js';
import { OAuthProviderName } from './oauth/oauth.service.js';

/**
 * Account registration, login, Google/Outlook sign-in and machine
 * API-token management.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and obtain an access token' })
  @ApiOkResponse({ description: 'JWT access token' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() credentials: CredentialsDto): Promise<AuthResponseDto> {
    return this.auth.login(credentials.email, credentials.password);
  }

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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current account API tokens' })
  @ApiOkResponse({ description: 'Active tokens (metadata only)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  listTokens(@CurrentUser() user: AuthPrincipal): Promise<ApiToken[]> {
    return this.auth.listApiTokens(user.id);
  }

  @Delete('tokens/:id')
  @UseGuards(JwtAuthGuard)
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
  private buildFrontendCallbackUrl(key: 'token' | 'error', value: string): string {
    const base = this.auth.frontendBaseUrl();
    return `${base}/auth/callback?${key}=${encodeURIComponent(value)}`;
  }
}