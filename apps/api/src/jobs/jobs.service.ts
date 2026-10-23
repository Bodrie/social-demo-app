import { Injectable, Logger } from '@nestjs/common';
import { AccountService, UNVERIFIED_ACCOUNT_POLICY } from '../account/account.service.js';
import { AchievementsService } from '../achievements/achievements.service.js';
import { EmailTokensService } from '../auth/email-tokens.service.js';
import { RefreshTokensService } from '../auth/refresh-tokens.service.js';
import {
  NOTIFICATION_RETENTION_DAYS,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { PollsService } from '../posts/polls.service.js';
import { PushService } from '../push/push.service.js';
import { UploadsService } from '../uploads/uploads.service.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** An upload nobody attached within this time was abandoned (a closed tab, a cancelled post). */
export const ORPHAN_UPLOAD_GRACE_MS = 24 * HOUR_MS;

type Job = { name: string; run: (now: Date) => Promise<number> };

const before = (now: Date, ms: number): Date => new Date(now.getTime() - ms);

/**
 * The daily housekeeping (ADR 0012, C6) and the frequent jobs (ADR 0012 amendment 2, F3):
 * things that are due at a moment, like the end of a poll. Every job is owned by the module
 * whose table it works on and takes the clock as a parameter, so tests run them with a date of
 * their own; this service only decides the cut-offs, the order, and that one failure never
 * stops the rest. `JobsScheduler` calls `runDaily` and `runFrequent` on their timers.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs: Job[];
  private readonly frequentJobs: Job[];
  private readonly running = { daily: false, frequent: false };

  constructor(
    emailTokens: EmailTokensService,
    refreshTokens: RefreshTokensService,
    account: AccountService,
    uploads: UploadsService,
    notifications: NotificationsService,
    push: PushService,
    achievements: AchievementsService,
    polls: PollsService,
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
      // Tenure, and whatever a failed listener missed (ADR 0021).
      { name: 'achievements', run: (now) => achievements.sweep(now) },
    ];
    // Due at a moment rather than overnight; each is idempotent through a `*_notified_at` stamp.
    this.frequentJobs = [{ name: 'ended polls', run: (now) => polls.endClosed(now) }];
  }

  /** Every daily job once, in order; a failing job is logged and the next one still runs. */
  runDaily(now = new Date()): Promise<void> {
    return this.runAll('daily', this.jobs, now);
  }

  /** Every frequent job once (every few minutes); only what did something is logged. */
  runFrequent(now = new Date()): Promise<void> {
    return this.runAll('frequent', this.frequentJobs, now);
  }

  private async runAll(kind: 'daily' | 'frequent', jobs: Job[], now: Date): Promise<void> {
    if (this.running[kind]) {
      this.logger.warn({ kind }, 'The jobs are still running; this run is skipped');
      return;
    }
    this.running[kind] = true;
    try {
      for (const job of jobs) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- one job at a time, on purpose
          const count = await job.run(now);
          // Every five minutes: a line per run would bury the log.
          if (kind === 'daily' || count > 0) {
            this.logger.log({ job: job.name, count }, 'Job finished');
          }
        } catch (error) {
          this.logger.error({ err: error, job: job.name }, 'Job failed');
        }
      }
    } finally {
      this.running[kind] = false;
    }
  }
}
