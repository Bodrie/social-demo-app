import { Injectable } from '@nestjs/common';
import type { Paginated, TrendingTag } from '@beso/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Tags are "trending" by how many posts carried them in the last week. */
export const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The most used tags of the window, most used first, ties alphabetically. Not paginated. */
  async trending(limit: number): Promise<Paginated<TrendingTag>> {
    const since = new Date(Date.now() - TRENDING_WINDOW_MS);
    const groups = await this.prisma.postHashtag.groupBy({
      by: ['tag'],
      where: { createdAt: { gte: since } },
      _count: { postId: true },
      orderBy: [{ _count: { postId: 'desc' } }, { tag: 'asc' }],
      take: limit,
    });
    return {
      items: groups.map((group) => ({ tag: group.tag, count: group._count.postId })),
      nextCursor: null,
    };
  }
}
