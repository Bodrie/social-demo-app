import { Logger } from '@nestjs/common';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { AccountService } from '../account/account.service.js';
import type { EmailTokensService } from '../auth/email-tokens.service.js';
import type { RefreshTokensService } from '../auth/refresh-tokens.service.js';
import type { UploadsService } from '../uploads/uploads.service.js';
import { JobsService } from './jobs.service.js';

const now = new Date('2026-10-20T04:00:00.000Z');

describe('JobsService.runDaily', () => {
  let emailTokens: DeepMockProxy<EmailTokensService>;
  let refreshTokens: DeepMockProxy<RefreshTokensService>;
  let account: DeepMockProxy<AccountService>;
  let uploads: DeepMockProxy<UploadsService>;
  let service: JobsService;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    emailTokens = mockDeep<EmailTokensService>();
    refreshTokens = mockDeep<RefreshTokensService>();
    account = mockDeep<AccountService>();
    uploads = mockDeep<UploadsService>();
    emailTokens.deleteExpired.mockResolvedValue(0);
    refreshTokens.deleteExpired.mockResolvedValue(0);
    account.eraseUnverified.mockResolvedValue(0);
    account.warnUnverified.mockResolvedValue(0);
    uploads.deleteOrphans.mockResolvedValue(0);
    service = new JobsService(emailTokens, refreshTokens, account, uploads);
  });

  it('runs every job with the cut-offs of the retention policy', async () => {
    await service.runDaily(now);

    expect(emailTokens.deleteExpired).toHaveBeenCalledWith(now);
    expect(refreshTokens.deleteExpired).toHaveBeenCalledWith(now);
    expect(account.eraseUnverified).toHaveBeenCalledWith(new Date('2026-09-20T04:00:00.000Z'));
    expect(account.warnUnverified).toHaveBeenCalledWith(new Date('2026-09-27T04:00:00.000Z'), now);
    expect(uploads.deleteOrphans).toHaveBeenCalledWith(new Date('2026-10-19T04:00:00.000Z'));
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
