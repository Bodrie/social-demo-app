import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { EmailService } from './email.service.js';
import { MAILER, type Mailer } from './mailer.js';
import { OutboxMailer } from './outbox.mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Mailer =>
        config.get('EMAIL_TRANSPORT', { infer: true }) === 'smtp'
          ? new SmtpMailer(config)
          : new OutboxMailer(config),
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
