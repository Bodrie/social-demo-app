import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import { DAILY_JOB, JobsScheduler } from './jobs.scheduler.js';
import type { JobsService } from './jobs.service.js';

const config = (enabled: boolean): ConfigService<Env, true> =>
  ({ get: () => enabled }) as unknown as ConfigService<Env, true>;

describe('JobsScheduler', () => {
  let registry: SchedulerRegistry;
  let jobs: DeepMockProxy<JobsService>;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    registry = new SchedulerRegistry();
    jobs = mockDeep<JobsService>();
    jobs.runDaily.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (registry.doesExist('cron', DAILY_JOB)) registry.deleteCronJob(DAILY_JOB);
  });

  it('registers the daily run when JOBS_ENABLED is on, and its tick runs the jobs', async () => {
    new JobsScheduler(registry, jobs, config(true)).onApplicationBootstrap();

    const job = registry.getCronJob(DAILY_JOB);
    expect(job.isActive).toBe(true);
    await job.fireOnTick();
    expect(jobs.runDaily).toHaveBeenCalledTimes(1);
  });

  it('registers nothing when JOBS_ENABLED is off', () => {
    new JobsScheduler(registry, jobs, config(false)).onApplicationBootstrap();

    expect(registry.getCronJobs().size).toBe(0);
  });
});
