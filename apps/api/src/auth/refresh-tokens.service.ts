import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { unauthorized } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { SessionsRevokedEvent } from '../events/auth.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestMeta } from './auth.types.js';

export type IssuedRefreshToken = { raw: string; expiresAt: Date };

type Writer = Pick<PrismaService, 'refreshToken'> | Prisma.TransactionClient;

/**
 * Opaque, single-use refresh tokens. Only a SHA-256 hash is stored. Rotation
 * claims the old token and issues the new one in one transaction; presenting
 * an already-rotated token is treated as theft and revokes every session of
 * that user. Logout deletes the row outright, so a logged-out token replayed
 * later is merely invalid and cannot be used to log the user out everywhere.
 */
@Injectable()
export class RefreshTokensService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TTL_SECONDS', { infer: true }) * 1000;
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  issue(userId: string, meta: RequestMeta): Promise<IssuedRefreshToken> {
    return this.issueWith(this.prisma, userId, meta);
  }

  async rotate(raw: string, meta: RequestMeta): Promise<IssuedRefreshToken & { userId: string }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
    if (!existing) throw unauthorized('Invalid refresh token');

    if (existing.revokedAt !== null) {
      await this.revokeAll(existing.userId);
      throw unauthorized('Refresh token was already used; all sessions have been revoked');
    }
    if (existing.expiresAt <= new Date()) throw unauthorized('Refresh token expired');

    const issued = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      return this.issueWith(tx, existing.userId, meta);
    });
    if (!issued) {
      await this.revokeAll(existing.userId);
      throw unauthorized('Refresh token was already used; all sessions have been revoked');
    }

    return { userId: existing.userId, ...issued };
  }

  /** Logout: the token simply ceases to exist. */
  async revoke(raw: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash: this.hash(raw) } });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.events.emitAsync(SessionsRevokedEvent.EVENT, new SessionsRevokedEvent(userId));
  }

  private async issueWith(writer: Writer, userId: string, meta: RequestMeta): Promise<IssuedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await writer.refreshToken.create({
      data: { userId, tokenHash: this.hash(raw), expiresAt, userAgent: meta.userAgent, ip: meta.ip },
    });
    await writer.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return { raw, expiresAt };
  }
}
