import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_TOKEN_POLICY, EmailTokensService } from './email-tokens.service.js';

const now = new Date('2026-10-16T12:00:00.000Z');
const ago = (ms: number) => ({ createdAt: new Date(now.getTime() - ms) });

describe('EmailTokensService.issue', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: EmailTokensService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new EmailTokensService(prisma);
    prisma.emailToken.findMany.mockResolvedValue([]);
    prisma.emailToken.create.mockResolvedValue({} as never);
    prisma.$transaction.mockResolvedValue([] as never);
  });

  it('adds a reset link without voiding the ones already mailed', async () => {
    prisma.emailToken.findMany.mockResolvedValue([ago(2 * 60_000)] as never);

    const raw = await service.issue('user-1', 'password_reset', now);

    expect(raw).toEqual(expect.any(String));
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        kind: 'password_reset',
        tokenHash: service.hash(raw ?? ''),
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.emailToken.updateMany).not.toHaveBeenCalled();
  });

  it('sends no second reset mail within the cooldown, whoever asks', async () => {
    const { cooldownMs } = EMAIL_TOKEN_POLICY.password_reset;
    prisma.emailToken.findMany.mockResolvedValue([ago(cooldownMs - 1)] as never);

    await expect(service.issue('user-1', 'password_reset', now)).resolves.toBeNull();
    expect(prisma.emailToken.create).not.toHaveBeenCalled();
  });

  it('stops at the hourly cap of a kind', async () => {
    const { perHour } = EMAIL_TOKEN_POLICY.password_reset;
    prisma.emailToken.findMany.mockResolvedValue(
      Array.from({ length: perHour }, (_, i) => ago(50 * 60_000 - i * 60_000)) as never,
    );

    await expect(service.issue('user-1', 'password_reset', now)).resolves.toBeNull();
    expect(prisma.emailToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          kind: 'password_reset',
          createdAt: { gt: new Date(now.getTime() - 60 * 60_000) },
        },
      }),
    );
  });

  it('replaces older confirmation links with the new one', async () => {
    const raw = await service.issue('user-1', 'verify_email', now);

    expect(raw).toEqual(expect.any(String));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.emailToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', kind: 'verify_email', usedAt: null },
      data: { usedAt: now },
    });
  });
});
