import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { badRequest } from '../common/errors.js';
import { PASSWORD_RESET_TTL_MS, VERIFY_EMAIL_TTL_MS } from '../email/email.service.js';
import type { EmailTokenKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const HOUR_MS = 60 * 60 * 1000;

type Policy = {
  ttlMs: number;
  /** Minimum time between two mails of this kind to one account. */
  cooldownMs: number;
  /** Mails of this kind one account may get within an hour. */
  perHour: number;
  /** Whether a new link voids the older ones. */
  replacesOlder: boolean;
};

/**
 * Per account, whoever asks and from wherever: the request throttlers count per address, so on
 * their own they let a few addresses flood one inbox (and the provider's daily quota).
 */
export const EMAIL_TOKEN_POLICY: Record<EmailTokenKind, Policy> = {
  // Only the newest confirmation link works; a member who lost one simply asks again.
  verify_email: { ttlMs: VERIFY_EMAIL_TTL_MS, cooldownMs: 0, perHour: 5, replacesOlder: true },
  // Every reset link stays good until it expires or one of them is used, so a stranger asking
  // for more mails cannot void the link the owner is about to open.
  password_reset: {
    ttlMs: PASSWORD_RESET_TTL_MS,
    cooldownMs: 60_000,
    perHour: 5,
    replacesOlder: false,
  },
};

export const INVALID_LINK = 'This link is invalid, has expired or was already used';

/**
 * The opaque tokens behind the links we mail. Same discipline as refresh tokens: 256 random
 * bits, only the SHA-256 stored, single use, short-lived. How many may be issued, and whether
 * a new one voids the older ones, is per kind (EMAIL_TOKEN_POLICY); using one is an atomic
 * claim so a link cannot be spent twice.
 */
@Injectable()
export class EmailTokensService {
  constructor(private readonly prisma: PrismaService) {}

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** A new link, or null when the account already had its share of this kind of mail lately. */
  async issue(userId: string, kind: EmailTokenKind, now = new Date()): Promise<string | null> {
    const policy = EMAIL_TOKEN_POLICY[kind];
    const recent = await this.prisma.emailToken.findMany({
      where: { userId, kind, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: policy.perHour,
    });
    const latest = recent[0];
    if (recent.length >= policy.perHour) return null;
    if (latest && now.getTime() - latest.createdAt.getTime() < policy.cooldownMs) return null;

    const raw = randomBytes(32).toString('base64url');
    const create = this.prisma.emailToken.create({
      data: {
        userId,
        kind,
        tokenHash: this.hash(raw),
        createdAt: now,
        expiresAt: new Date(now.getTime() + policy.ttlMs),
      },
    });
    if (policy.replacesOlder) {
      await this.prisma.$transaction([
        this.prisma.emailToken.updateMany({
          where: { userId, kind, usedAt: null },
          data: { usedAt: now },
        }),
        create,
      ]);
    } else {
      await create;
    }
    return raw;
  }

  /** Spends the token and returns its owner; every failure is the same 400 so nothing leaks. */
  async consume(raw: string, kind: EmailTokenKind): Promise<string> {
    const tokenHash = this.hash(raw);
    const claimed = await this.prisma.emailToken.updateMany({
      where: { tokenHash, kind, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw badRequest(INVALID_LINK, { token: INVALID_LINK });
    const token = await this.prisma.emailToken.findUniqueOrThrow({
      where: { tokenHash },
      select: { userId: true },
    });
    return token.userId;
  }

  /** After a password change or reset nothing mailed earlier may still reset it. */
  async voidAll(userId: string, kind: EmailTokenKind): Promise<void> {
    await this.prisma.emailToken.updateMany({
      where: { userId, kind, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Housekeeping (JobsService): an expired token can never be spent, and the hourly limits
   * only look at the last hour, so nothing is lost by dropping the rows. Returns the count.
   */
  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.emailToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return count;
  }
}
