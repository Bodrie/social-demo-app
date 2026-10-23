import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import { DAILY_JOB, FREQUENT_JOB, JobsScheduler } from './jobs.scheduler.js';
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
    jobs.runFrequent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const name of [DAILY_JOB, FREQUENT_JOB]) {
      if (registry.doesExist('cron', name)) registry.deleteCronJob(name);
    }
  });

  it('registers both runs when JOBS_ENABLED is on, and their ticks run the jobs', async () => {
    new JobsScheduler(registry, jobs, config(true)).onApplicationBootstrap();

    const daily = registry.getCronJob(DAILY_JOB);
    expect(daily.isActive).toBe(true);
    await daily.fireOnTick();
    expect(jobs.runDaily).toHaveBeenCalledTimes(1);
    const frequent = registry.getCronJob(FREQUENT_JOB);
    expect(frequent.isActive).toBe(true);
    await frequent.fireOnTick();
    expect(jobs.runFrequent).toHaveBeenCalledTimes(1);
    expect(jobs.runDaily).toHaveBeenCalledTimes(1);
  });

  it('registers nothing when JOBS_ENABLED is off', () => {
    new JobsScheduler(registry, jobs, config(false)).onApplicationBootstrap();

    expect(registry.getCronJobs().size).toBe(0);
  });
});
