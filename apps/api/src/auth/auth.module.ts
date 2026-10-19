import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CaptchaModule } from '../captcha/captcha.module.js';
import type { Env } from '../config/env.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokensService } from './email-tokens.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

const JWT_ISSUER = 'the-mesh';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    CaptchaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        },
        verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokensService, EmailTokensService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
