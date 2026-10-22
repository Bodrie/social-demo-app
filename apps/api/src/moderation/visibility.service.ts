import { Injectable } from '@nestjs/common';
import { blocked } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type Relationship = { blocked: boolean; blockedMe: boolean; muted: boolean };

/**
 * Who may not see whom (ADR 0016). A block works both ways and is enforced here and in the
 * services, never by the client; a mute works for the muter alone. Services ask for the id
 * lists and put them into their `where`s, so every list answers the same question the same way.
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Members on either side of a block with the viewer, plus every suspended member: nothing
   * of theirs reaches the viewer (ADR 0016).
   */
  async blockedIds(viewerId: string): Promise<string[]> {
    const [blocks, suspended] = await Promise.all([
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
        select: { blockerId: true, blockedId: true },
      }),
      this.prisma.user.findMany({
        where: { suspendedAt: { not: null }, id: { not: viewerId } },
        select: { id: true },
      }),
    ]);
    return [
      ...new Set([
        ...blocks.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)),
        ...suspended.map((row) => row.id),
      ]),
    ];
  }

  /** Authors the viewer's feeds leave out: the blocked set plus whom the viewer muted. */
  async hiddenAuthorIds(viewerId: string): Promise<string[]> {
    const [blocks, mutes] = await Promise.all([
      this.blockedIds(viewerId),
      this.prisma.mute.findMany({ where: { muterId: viewerId }, select: { mutedId: true } }),
    ]);
    return [...new Set([...blocks, ...mutes.map((row) => row.mutedId)])];
  }

  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }

  /** 403 `BLOCKED` when either of the two blocked the other. */
  async assertNotBlocked(viewerId: string, otherId: string): Promise<void> {
    if (await this.isBlockedBetween(viewerId, otherId)) throw blocked();
  }

  /**
   * The members among `viewerIds` who may see something by, about or on the posts of every one
   * of `subjectIds`: `hiddenAuthorIds` asked the other way round, in three queries however many
   * viewers there are (for pushes that go to many). Nobody, when a subject is suspended.
   */
  async viewersOf(viewerIds: readonly string[], subjectIds: readonly string[]): Promise<string[]> {
    if (viewerIds.length === 0) return [];
    const subjects = [...new Set(subjectIds)];
    const [suspended, blocks, mutes] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: subjects }, suspendedAt: { not: null } } }),
      this.prisma.block.findMany({
        where: {
          OR: [
            { blockerId: { in: [...viewerIds] }, blockedId: { in: subjects } },
            { blockerId: { in: subjects }, blockedId: { in: [...viewerIds] } },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      this.prisma.mute.findMany({
        where: { muterId: { in: [...viewerIds] }, mutedId: { in: subjects } },
        select: { muterId: true },
      }),
    ]);
    if (suspended > 0) return [];
    const viewers = new Set(viewerIds);
    const subjectSet = new Set(subjects);
    const excluded = new Set(mutes.map((row) => row.muterId));
    for (const { blockerId, blockedId } of blocks) {
      if (viewers.has(blockerId) && subjectSet.has(blockedId)) excluded.add(blockerId);
      if (viewers.has(blockedId) && subjectSet.has(blockerId)) excluded.add(blockedId);
    }
    return viewerIds.filter((id) => !excluded.has(id));
  }

  /** Notifications: nothing from someone the recipient blocked, who blocked them, or whom they muted. */
  async isSilencedFor(recipientId: string, actorId: string): Promise<boolean> {
    if (await this.isBlockedBetween(recipientId, actorId)) return true;
    const muted = await this.prisma.mute.count({
      where: { muterId: recipientId, mutedId: actorId },
    });
    return muted > 0;
  }

  /** The flags a profile carries about the viewer and its owner. */
  async relationship(viewerId: string, otherId: string): Promise<Relationship> {
    const [byViewer, byOther, mutes] = await Promise.all([
      this.prisma.block.count({ where: { blockerId: viewerId, blockedId: otherId } }),
      this.prisma.block.count({ where: { blockerId: otherId, blockedId: viewerId } }),
      this.prisma.mute.count({ where: { muterId: viewerId, mutedId: otherId } }),
    ]);
    return { blocked: byViewer > 0, blockedMe: byOther > 0, muted: mutes > 0 };
  }
}
