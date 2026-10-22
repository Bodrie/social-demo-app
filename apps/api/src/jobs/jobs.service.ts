import { Injectable, Logger } from '@nestjs/common';
import { AccountService, UNVERIFIED_ACCOUNT_POLICY } from '../account/account.service.js';
import { EmailTokensService } from '../auth/email-tokens.service.js';
import { RefreshTokensService } from '../auth/refresh-tokens.service.js';
import {
  NOTIFICATION_RETENTION_DAYS,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { PushService } from '../push/push.service.js';
import { UploadsService } from '../uploads/uploads.service.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** An upload nobody attached within this time was abandoned (a closed tab, a cancelled post). */
export const ORPHAN_UPLOAD_GRACE_MS = 24 * HOUR_MS;

type Job = { name: string; run: (now: Date) => Promise<number> };

const before = (now: Date, ms: number): Date => new Date(now.getTime() - ms);

/**
 * The daily housekeeping (ADR 0012, C6). Every job is owned by the module whose table it
 * cleans and takes the clock as a parameter, so tests run them with a date of their own;
 * this service only decides the cut-offs, the order, and that one failure never stops the
 * rest. `JobsScheduler` calls `runDaily` on the timer.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs: Job[];
  private running = false;

  constructor(
    emailTokens: EmailTokensService,
    refreshTokens: RefreshTokensService,
    account: AccountService,
    uploads: UploadsService,
    notifications: NotificationsService,
    push: PushService,
  ) {
    const { warnAfterDays, deleteAfterDays } = UNVERIFIED_ACCOUNT_POLICY;
    this.jobs = [
      { name: 'expired email tokens', run: (now) => emailTokens.deleteExpired(now) },
      { name: 'expired refresh tokens', run: (now) => refreshTokens.deleteExpired(now) },
      // After the tokens: a sign-in whose last token expired takes its push devices along.
      { name: 'push devices of ended sign-ins', run: (now) => push.pruneEnded(now) },
      {
        name: 'unverified accounts',
        run: (now) => account.eraseUnverified(before(now, deleteAfterDays * DAY_MS)),
      },
      {
        name: 'unverified account warnings',
        run: (now) => account.warnUnverified(before(now, warnAfterDays * DAY_MS), now),
      },
      {
        name: 'orphaned uploads',
        run: (now) => uploads.deleteOrphans(before(now, ORPHAN_UPLOAD_GRACE_MS)),
      },
      { name: 'upload sizes', run: () => uploads.fillSizes() },
      {
        name: 'old notifications',
        run: (now) =>
          notifications.deleteOlderThan(before(now, NOTIFICATION_RETENTION_DAYS * DAY_MS)),
      },
    ];
  }

  /** Every job once, in order; a failing job is logged and the next one still runs. */
  async runDaily(now = new Date()): Promise<void> {
    if (this.running) {
      this.logger.warn('The daily jobs are still running; this run is skipped');
      return;
    }
    this.running = true;
    try {
      for (const job of this.jobs) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- one job at a time, on purpose
          const count = await job.run(now);
          this.logger.log({ job: job.name, count }, 'Job finished');
        } catch (error) {
          this.logger.error({ err: error, job: job.name }, 'Job failed');
        }
      }
    } finally {
      this.running = false;
    }
  }
}
