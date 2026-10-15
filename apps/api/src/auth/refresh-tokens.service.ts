import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestMeta } from './auth.types.js';

export type IssuedRefreshToken = { raw: string; expiresAt: Date };

/**
 * Opaque, single-use refresh tokens. Only a SHA-256 hash is stored. Rotation
 * claims the old token atomically; presenting an already-rotated token is
 * treated as theft and revokes every session of that user.
 */
@Injectable()
export class RefreshTokensService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TTL_SECONDS', { infer: true }) * 1000;
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issue(userId: string, meta: RequestMeta): Promise<IssuedRefreshToken> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(raw), expiresAt, userAgent: meta.userAgent, ip: meta.ip },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return { raw, expiresAt };
  }

  async rotate(raw: string, meta: RequestMeta): Promise<IssuedRefreshToken & { userId: string }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
    if (!existing) throw this.unauthorized('Invalid refresh token');

    if (existing.revokedAt !== null) {
      await this.revokeAll(existing.userId);
      throw this.unauthorized('Refresh token was already used; all sessions have been revoked');
    }
    if (existing.expiresAt <= new Date()) throw this.unauthorized('Refresh token expired');

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.revokeAll(existing.userId);
      throw this.unauthorized('Refresh token was already used; all sessions have been revoked');
    }

    const issued = await this.issue(existing.userId, meta);
    return { userId: existing.userId, ...issued };
  }

  async revoke(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private unauthorized(message: string): UnauthorizedException {
    return new UnauthorizedException({ code: 'UNAUTHORIZED', message });
  }
}
