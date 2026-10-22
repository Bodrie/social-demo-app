import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JwtModuleOptions, JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { AccessTokensService } from './access-tokens.service.js';

const JWT_ISSUER = 'beso';

export function accessTokenJwtOptions(secret: string, ttlSeconds: number): JwtModuleOptions {
  return {
    secret,
    signOptions: { algorithm: 'HS256', issuer: JWT_ISSUER, expiresIn: ttlSeconds },
    verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER },
  };
}

/**
 * Access tokens on their own, so the global guard and the chat gateway can check a session
 * without importing AuthModule (sign-in, refresh rotation, mail, captcha) wholesale.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        accessTokenJwtOptions(
          config.get('JWT_SECRET', { infer: true }),
          config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        ),
    }),
  ],
  providers: [AccessTokensService],
  exports: [AccessTokensService],
})
export class TokensModule {}
