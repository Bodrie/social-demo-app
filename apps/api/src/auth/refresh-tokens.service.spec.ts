import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

const config = { get: () => 7 * 24 * 60 * 60 } as unknown as ConfigService<Env, true>;
const meta = { userAgent: 'vitest', ip: '127.0.0.1' };
const stored = {
  id: 'token-1',
  userId: 'user-1',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null as Date | null,
};

describe('RefreshTokensService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: RefreshTokensService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new RefreshTokensService(prisma, mockDeep<EventEmitter2>(), config);
    prisma.$transaction.mockImplementation(async (fn) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
    prisma.refreshToken.create.mockResolvedValue({} as never);
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('stores only a hash of the issued token', async () => {
    const issued = await service.issue('user-1', meta);

    const call = prisma.refreshToken.create.mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ userId: 'user-1', tokenHash: service.hash(issued.raw), userAgent: 'vitest' });
    expect(call?.data).not.toMatchObject({ tokenHash: issued.raw });
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rotates a valid token: claims the old one and issues a new one', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(stored as never);

    const rotated = await service.rotate('old-raw', meta);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(rotated.userId).toBe('user-1');
    expect(rotated.raw).not.toBe('old-raw');
  });

  it('revokes every session when a rotated token is presented again', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ ...stored, revokedAt: new Date() } as never);

    await expect(service.rotate('old-raw', meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes every session when two rotations race for the same token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(stored as never);
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.rotate('old-raw', meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects unknown and expired tokens', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.rotate('missing', meta)).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValueOnce({ ...stored, expiresAt: new Date(Date.now() - 1) } as never);
    await expect(service.rotate('expired', meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
