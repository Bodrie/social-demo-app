import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { Env } from '../config/env.js';
import { JobsService } from './jobs.service.js';

export const DAILY_JOB = 'daily-housekeeping';
/** 04:00 in the process time zone (UTC in the container): the quietest hour for the audience. */
export const DAILY_AT = '0 4 * * *';

/**
 * Registers the daily run only when this process is the one meant to run it (`JOBS_ENABLED`):
 * with several API containers exactly one may, or every job would run several times a night.
 * The job is added through the registry rather than `@Cron` so that a disabled process has no
 * timer at all; the schedule module stops every registered job on shutdown.
 */
@Injectable()
export class JobsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly jobs: JobsService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('JOBS_ENABLED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('JOBS_ENABLED=false: this process runs no scheduled jobs');
      return;
    }
    const job = CronJob.from({
      cronTime: DAILY_AT,
      onTick: () => this.jobs.runDaily(),
      // The next tick waits for the running one (runDaily skips overlaps too; belt and braces).
      waitForCompletion: true,
      start: true,
    });
    this.registry.addCronJob(DAILY_JOB, job);
    this.logger.log({ job: DAILY_JOB, cron: DAILY_AT }, 'Scheduled jobs enabled');
  }
}
