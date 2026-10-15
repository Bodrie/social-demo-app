import { Injectable } from '@nestjs/common';
import type { Activity, CursorQuery, Paginated } from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { activitySelect, toActivity } from './activities.mapper.js';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  /** What the people the viewer follows have been doing, newest first. */
  async forViewer(viewerId: string, query: CursorQuery): Promise<Paginated<Activity>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.activity.findMany({
      where: {
        AND: [
          { actor: { followers: { some: { followerId: viewerId } } } },
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
