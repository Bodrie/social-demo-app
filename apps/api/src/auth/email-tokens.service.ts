import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { badRequest } from '../common/errors.js';
import { PASSWORD_RESET_TTL_MS, VERIFY_EMAIL_TTL_MS } from '../email/email.service.js';
import type { EmailTokenKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TTL_MS: Record<EmailTokenKind, number> = {
  verify_email: VERIFY_EMAIL_TTL_MS,
  password_reset: PASSWORD_RESET_TTL_MS,
};

export const INVALID_LINK = 'This link is invalid, has expired or was already used';

/**
 * The opaque tokens behind the links we mail. Same discipline as refresh tokens: 256 random
 * bits, only the SHA-256 stored, single use, short-lived. Issuing a new one voids the older
 * links of the same kind, and using one is an atomic claim so a link cannot be spent twice.
 */
@Injectable()
export class EmailTokensService {
  constructor(private readonly prisma: PrismaService) {}

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issue(userId: string, kind: EmailTokenKind): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailToken.updateMany({
        where: { userId, kind, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailToken.create({
        data: {
          userId,
          kind,
          tokenHash: this.hash(raw),
          expiresAt: new Date(Date.now() + TTL_MS[kind]),
        },
      }),
    ]);
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

  /** After a password change nothing mailed earlier may still reset it. */
  async voidAll(userId: string, kind: EmailTokenKind): Promise<void> {
    await this.prisma.emailToken.updateMany({
      where: { userId, kind, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
