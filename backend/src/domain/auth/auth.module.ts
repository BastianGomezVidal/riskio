import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { ApiToken } from './entities/api-token.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { MailerService } from './mailer.service.js';
import { OAuthService } from './oauth/oauth.service.js';
import { parseDurationToSeconds } from './auth.utils.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
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
  /**
   * No APP_GUARD here, and the removal is deliberate rather than a leftover.
   * The guard used to be registered globally because this module was the API's
   * own. Now this service sits behind the API, which has already resolved the
   * principal on the way in, so guarding again would mean a second round trip
   * to answer a question the caller already settled.
   */
  providers: [AuthService, OAuthService, MailerService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
