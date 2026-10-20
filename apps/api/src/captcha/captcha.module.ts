import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { CAPTCHA, type CaptchaVerifier } from './captcha.js';
import { NoopVerifier } from './noop.verifier.js';
import { TurnstileVerifier } from './turnstile.verifier.js';

@Module({
  providers: [
    {
      provide: CAPTCHA,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CaptchaVerifier => {
        const secret = config.get('TURNSTILE_SECRET', { infer: true });
        if (secret) return new TurnstileVerifier(secret);
        new Logger('CaptchaModule').log(
          'No TURNSTILE_SECRET: registration runs without a bot check',
        );
        return new NoopVerifier();
      },
    },
  ],
  exports: [CAPTCHA],
})
export class CaptchaModule {}
