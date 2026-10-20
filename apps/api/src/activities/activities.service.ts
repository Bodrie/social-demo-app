import { Injectable } from '@nestjs/common';
import type { Activity, CursorQuery, Paginated } from '@beso/shared';
import { AssetsService } from '../assets/assets.service.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { activitySelect, toActivity } from './activities.mapper.js';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * What the people the viewer follows have been doing, newest first; nothing by, about or
   * on the posts of someone the viewer blocked, who blocked them, or whom they muted.
   */
  async forViewer(viewerId: string, query: CursorQuery): Promise<Paginated<Activity>> {
    const cursor = decodeCursor(query.cursor);
    const hidden = await this.visibility.hiddenAuthorIds(viewerId);
    const rows = await this.prisma.activity.findMany({
      where: {
        AND: [
          { actor: { followers: { some: { followerId: viewerId } } } },
          { actorId: { notIn: hidden } },
          { OR: [{ targetUserId: null }, { targetUserId: { notIn: hidden } }] },
          { OR: [{ postId: null }, { post: { authorId: { notIn: hidden } } }] },
          cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {},
        ],
      },
      select: activitySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toActivity(row, this.assets.base));
  }
}
