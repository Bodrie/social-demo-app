import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { unauthorized } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { SessionsEndedEvent, SessionsRevokedEvent } from '../events/auth.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestMeta } from './auth.types.js';

/** `signInId`: the sign-in the token descends from, the access token's `sid` (ADR 0022). */
export type IssuedRefreshToken = { raw: string; expiresAt: Date; signInId: string };

export type SessionRow = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
};

type Writer = Pick<PrismaService, 'refreshToken'> | Prisma.TransactionClient;

/**
 * Opaque, single-use refresh tokens. Only a SHA-256 hash is stored. Rotation
 * claims the old token and issues the new one in one transaction; presenting
 * an already-rotated token is treated as theft and revokes every session of
 * that user. `revokedAt` therefore means "rotated" and nothing else: every
 * other way a session ends (logout, password change or reset, sign out
 * everywhere, the theft response itself) deletes the rows, so a token from an
 * ended session replayed later is merely invalid and can never be used to log
 * the owner out of the sessions that are still meant to work.
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
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        signInId: true,
      },
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
      // The new row is the same session: it keeps when it started, its sign-in, and notes this use.
      return this.issueWith(tx, existing.userId, meta, existing.createdAt, existing.signInId);
    });
    if (!issued) {
      await this.revokeAll(existing.userId);
      throw unauthorized('Refresh token was already used; all sessions have been revoked');
    }

    return { userId: existing.userId, ...issued };
  }

  /** The sign-in of `raw` when it is a live (unrotated, unexpired) refresh token of `userId`. */
  async liveSignIn(raw: string, userId: string): Promise<string | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      select: { userId: true, expiresAt: true, revokedAt: true, signInId: true },
    });
    return row?.userId === userId && row.revokedAt === null && row.expiresAt > new Date()
      ? row.signInId
      : null;
  }

  /** Logout: the token simply ceases to exist. */
  async revoke(raw: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      select: { userId: true },
    });
    if (!row) return;
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash: this.hash(raw) } });
    await this.ended(row.userId);
  }

  /**
   * Password change: every other session ends, the caller's stays. Their access tokens live
   * on until they expire (15 min), so no socket disconnect is forced here. Rows are deleted,
   * rotated ones included, so nothing the other devices still hold can trigger reuse detection.
   */
  async revokeOthers(userId: string, keepRaw: string | undefined): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        ...(keepRaw === undefined ? {} : { tokenHash: { not: this.hash(keepRaw) } }),
      },
    });
    await this.ended(userId);
  }

  /** Sign out everywhere, password reset and the theft response: every session ends, sockets too. */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.events.emitAsync(SessionsRevokedEvent.EVENT, new SessionsRevokedEvent(userId));
    await this.ended(userId);
  }

  /**
   * Housekeeping (JobsService). `issueWith` already drops a user's expired tokens when they
   * sign in; this catches the sessions that simply never came back. Rotated tokens stay until
   * they expire: reuse detection needs them. Returns the count.
   */
  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return count;
  }

  /**
   * The live sessions (ADR 0010 amendment): one row per device, since a rotated token is
   * revoked and its successor carries the session's start. `current` is the caller's own.
   */
  async listFor(userId: string, currentRaw: string | undefined): Promise<SessionRow[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        tokenHash: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { id: 'desc' }],
    });
    const currentHash = currentRaw === undefined ? null : this.hash(currentRaw);
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ip: row.ip,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      current: row.tokenHash === currentHash,
    }));
  }

  /** Ends one session of the member; its access token runs out within its lifetime. */
  async revokeOne(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({ where: { id, userId } });
    if (result.count !== 1) return false;
    await this.ended(userId);
    return true;
  }

  private async ended(userId: string): Promise<void> {
    await this.events.emitAsync(SessionsEndedEvent.EVENT, new SessionsEndedEvent(userId));
  }

  private async issueWith(
    writer: Writer,
    userId: string,
    meta: RequestMeta,
    startedAt = new Date(),
    signInId?: string,
  ): Promise<IssuedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const created = await writer.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
        createdAt: startedAt,
        lastUsedAt: now,
        // A new sign-in gets a new id (the column's default); a rotation passes its own on.
        ...(signInId === undefined ? {} : { signInId }),
      },
      select: { signInId: true },
    });
    await writer.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return { raw, expiresAt, signInId: created.signInId };
  }
}
