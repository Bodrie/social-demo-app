import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Activity, CursorQuery, Paginated } from '@the-mesh/shared';
import { decodeCursor, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { activitySelect, toActivity } from './activities.mapper.js';

@Injectable()
export class ActivitiesService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  /** What the people the viewer follows have been doing, newest first. */
  async forViewer(viewerId: string, query: CursorQuery): Promise<Paginated<Activity>> {
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.activity.findMany({
      where: { actor: { followers: { some: { followerId: viewerId } } } },
      select: activitySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    return paginate(rows, query.limit, (row) => toActivity(row, this.assetsBase));
  }
}
