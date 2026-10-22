import { Logger } from '@nestjs/common';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { AccountService } from '../account/account.service.js';
import type { AchievementsService } from '../achievements/achievements.service.js';
import type { EmailTokensService } from '../auth/email-tokens.service.js';
import type { RefreshTokensService } from '../auth/refresh-tokens.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PushService } from '../push/push.service.js';
import type { UploadsService } from '../uploads/uploads.service.js';
import { JobsService } from './jobs.service.js';

const now = new Date('2026-10-20T04:00:00.000Z');

describe('JobsService.runDaily', () => {
  let emailTokens: DeepMockProxy<EmailTokensService>;
  let refreshTokens: DeepMockProxy<RefreshTokensService>;
  let account: DeepMockProxy<AccountService>;
  let uploads: DeepMockProxy<UploadsService>;
  let notifications: DeepMockProxy<NotificationsService>;
  let push: DeepMockProxy<PushService>;
  let achievements: DeepMockProxy<AchievementsService>;
  let service: JobsService;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    emailTokens = mockDeep<EmailTokensService>();
    refreshTokens = mockDeep<RefreshTokensService>();
    account = mockDeep<AccountService>();
    uploads = mockDeep<UploadsService>();
    notifications = mockDeep<NotificationsService>();
    push = mockDeep<PushService>();
    emailTokens.deleteExpired.mockResolvedValue(0);
    refreshTokens.deleteExpired.mockResolvedValue(0);
    account.eraseUnverified.mockResolvedValue(0);
    account.warnUnverified.mockResolvedValue(0);
    uploads.deleteOrphans.mockResolvedValue(0);
    notifications.deleteOlderThan.mockResolvedValue(0);
    push.pruneEnded.mockResolvedValue(0);
    achievements = mockDeep<AchievementsService>();
    achievements.sweep.mockResolvedValue(0);
    service = new JobsService(
      emailTokens,
      refreshTokens,
      account,
      uploads,
      notifications,
      push,
      achievements,
    );
  });

  it('runs every job with the cut-offs of the retention policy', async () => {
    await service.runDaily(now);

    expect(emailTokens.deleteExpired).toHaveBeenCalledWith(now);
    expect(refreshTokens.deleteExpired).toHaveBeenCalledWith(now);
    expect(push.pruneEnded).toHaveBeenCalledWith(now);
    expect(achievements.sweep).toHaveBeenCalledWith(now);
    expect(account.eraseUnverified).toHaveBeenCalledWith(new Date('2026-09-20T04:00:00.000Z'));
    expect(account.warnUnverified).toHaveBeenCalledWith(new Date('2026-09-27T04:00:00.000Z'), now);
    expect(uploads.deleteOrphans).toHaveBeenCalledWith(new Date('2026-10-19T04:00:00.000Z'));
    expect(notifications.deleteOlderThan).toHaveBeenCalledWith(
      new Date('2026-07-22T04:00:00.000Z'),
    );
  });

  it('goes on after a failing job', async () => {
    refreshTokens.deleteExpired.mockRejectedValue(new Error('database away'));

    await expect(service.runDaily(now)).resolves.toBeUndefined();

    expect(account.eraseUnverified).toHaveBeenCalledTimes(1);
    expect(uploads.deleteOrphans).toHaveBeenCalledTimes(1);
  });

  it('skips a run that starts while the previous one is still going', async () => {
    let finish!: (count: number) => void;
    emailTokens.deleteExpired.mockReturnValue(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );

    const first = service.runDaily(now);
    await service.runDaily(now);
    expect(emailTokens.deleteExpired).toHaveBeenCalledTimes(1);

    finish(0);
    await first;
    expect(uploads.deleteOrphans).toHaveBeenCalledTimes(1);

    await service.runDaily(now);
    expect(emailTokens.deleteExpired).toHaveBeenCalledTimes(2);
  });
});
