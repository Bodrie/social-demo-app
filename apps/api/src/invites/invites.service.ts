import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Invite, InviteLookup } from '@beso/shared';
import { AssetsService } from '../assets/assets.service.js';
import { notFound } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { FollowsService } from '../follows/follows.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

/**
 * Personal invite links (F1): a member's code, `/join/<code>`, made when first asked for and
 * replaced on request. Whoever registers with it follows the inviter once their address is
 * confirmed (`welcome`), and the inviter is told (`INVITE_JOINED`).
 */
@Injectable()
export class InvitesService {
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly follows: FollowsService,
    private readonly visibility: VisibilityService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/+$/, '');
  }

  async mine(userId: string): Promise<Invite> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { inviteCode: true },
    });
    return this.link(user.inviteCode ?? (await this.newCode(userId)));
  }

  /** A new code; the old link stops working. */
  async renew(userId: string): Promise<Invite> {
    return this.link(await this.newCode(userId));
  }

  /** The join page's question: whose link is this? Unknown codes and suspended members: 404. */
  async lookup(code: string): Promise<InviteLookup> {
    const inviter = await this.prisma.user.findFirst({
      where: { inviteCode: code, suspendedAt: null },
      select: userSummarySelect,
    });
    if (!inviter) throw notFound('This invite link does not work any more');
    return { inviter: toUserSummary(inviter, this.assets.base) };
  }

  /** Registration's question; a code that does not work is simply no invite. */
  async inviterOf(code: string | undefined): Promise<string | null> {
    if (!code) return null;
    const inviter = await this.prisma.user.findFirst({
      where: { inviteCode: code, suspendedAt: null },
      select: { id: true },
    });
    return inviter?.id ?? null;
  }

  /**
   * The account just opened: its member follows whoever invited them, unless that member is
   * gone, suspended or on either side of a block by now. Idempotent (a follow is).
   */
  async welcome(userId: string): Promise<void> {
    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { invitedBy: { select: { id: true, suspendedAt: true } } },
    });
    const inviter = member?.invitedBy;
    if (!inviter || inviter.suspendedAt) return;
    if (await this.visibility.isBlockedBetween(userId, inviter.id)) return;
    await this.follows.follow(userId, inviter.id, { viaInvite: true });
  }

  private link(code: string): Invite {
    return { code, url: `${this.webUrl}/join/${code}` };
  }

  private async newCode(userId: string): Promise<string> {
    // 72 random bits: nobody guesses one; a clash with another member's code is retried.
    for (let attempt = 0; ; attempt += 1) {
      const code = randomBytes(9).toString('base64url');
      try {
        // oxlint-disable-next-line no-await-in-loop -- a retry, not a batch
        await this.prisma.user.update({ where: { id: userId }, data: { inviteCode: code } });
        return code;
      } catch (error) {
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!clash || attempt >= 3) throw error;
      }
    }
  }
}
