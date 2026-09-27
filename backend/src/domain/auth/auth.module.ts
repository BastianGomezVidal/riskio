import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { ApiToken } from './entities/api-token.entity.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { MailerService } from './mailer.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { OAuthService } from './oauth/oauth.service.js';
import { parseDurationToSeconds } from './auth.utils.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ApiToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET')!,
        signOptions: {
          expiresIn: parseDurationToSeconds(
            config.get<string>('JWT_EXPIRES_IN', '15m'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    MailerService,
    JwtAuthGuard,
    ApiKeyGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtAuthGuard, ApiKeyGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
