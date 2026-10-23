import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { Env } from '../config/env.js';
import { JobsService } from './jobs.service.js';

export const DAILY_JOB = 'daily-housekeeping';
/** 04:00 in the process time zone (UTC in the container): the quietest hour for the audience. */
export const DAILY_AT = '0 4 * * *';
export const FREQUENT_JOB = 'frequent-jobs';
/** Every five minutes: a poll's end is told within five minutes of it (ADR 0012 amendment 2). */
export const FREQUENT_AT = '*/5 * * * *';

/**
 * Registers the daily and the frequent runs only when this process is the one meant to run
 * them (`JOBS_ENABLED`): with several API containers exactly one may, or every job would run
 * several times. The jobs are added through the registry rather than `@Cron` so that a
 * disabled process has no timer at all; the schedule module stops every registered job on
 * shutdown.
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
    this.schedule(DAILY_JOB, DAILY_AT, () => this.jobs.runDaily());
    this.schedule(FREQUENT_JOB, FREQUENT_AT, () => this.jobs.runFrequent());
  }

  private schedule(name: string, cronTime: string, onTick: () => Promise<void>): void {
    const job = CronJob.from({
      cronTime,
      onTick,
      // The next tick waits for the running one (the service skips overlaps too; belt and braces).
      waitForCompletion: true,
      start: true,
    });
    this.registry.addCronJob(name, job);
    this.logger.log({ job: name, cron: cronTime }, 'Scheduled jobs enabled');
  }
}
