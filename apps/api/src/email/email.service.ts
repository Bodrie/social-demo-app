import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MAILER, type Mailer } from './mailer.js';
import {
  accountDeletedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  unverifiedExpiryEmail,
  verificationEmail,
} from './templates.js';

export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type Recipient = { email: string; name: string };

/** Composes the messages we send; links point at the web app (`WEB_URL`). */
@Injectable()
export class EmailService {
  private readonly webUrl: string;

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/+$/, '');
  }

  sendVerification(to: Recipient, token: string): Promise<void> {
    return this.mailer.send({
      to: to.email,
      ...verificationEmail({
        name: to.name,
        link: this.link('/verify-email', token),
        hours: VERIFY_EMAIL_TTL_MS / 3_600_000,
      }),
    });
  }

  sendPasswordReset(to: Recipient, token: string): Promise<void> {
    return this.mailer.send({
      to: to.email,
      ...passwordResetEmail({
        name: to.name,
        link: this.link('/reset-password', token),
        minutes: PASSWORD_RESET_TTL_MS / 60_000,
      }),
    });
  }

  /** Sent after every password change or reset, so one the owner did not make is noticed. */
  sendPasswordChanged(to: Recipient): Promise<void> {
    return this.mailer.send({
      to: to.email,
      ...passwordChangedEmail({ name: to.name, link: `${this.webUrl}/forgot-password` }),
    });
  }

  /** Sent after the account is gone; the address is the only thing we still know. */
  sendAccountDeleted(to: Recipient): Promise<void> {
    return this.mailer.send({ to: to.email, ...accountDeletedEmail({ name: to.name }) });
  }

  /**
   * The one warning an unconfirmed account gets before it is removed: a fresh confirmation
   * link and the date after which the account goes (JobsService).
   */
  sendUnverifiedExpiry(
    to: Recipient,
    token: string,
    removal: { afterDays: number; on: Date },
  ): Promise<void> {
    return this.mailer.send({
      to: to.email,
      ...unverifiedExpiryEmail({
        name: to.name,
        link: this.link('/verify-email', token),
        hours: VERIFY_EMAIL_TTL_MS / 3_600_000,
        afterDays: removal.afterDays,
        removalDate: removal.on.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
      }),
    });
  }

  private link(path: string, token: string): string {
    return `${this.webUrl}${path}?token=${encodeURIComponent(token)}`;
  }
}
