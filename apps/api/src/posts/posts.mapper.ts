import type { Post, PostEmbed } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

/** Mentioned members, resolved at read time so a renamed member still links to the right profile. */
export const mentionsSelect = {
  select: { user: { select: userSummarySelect } },
  orderBy: { user: { username: 'asc' } },
} as const;

/** Everything a feed item needs, in one query: author, counts, entities, the embed and the viewer's flags. */
export function postSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    imageKey: true,
    editedAt: true,
    createdAt: true,
    updatedAt: true,
    author: { select: userSummarySelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    bookmarks: { where: { userId: viewerId }, select: { userId: true } },
    repostCount: true,
    reposts: { where: { userId: viewerId }, select: { userId: true } },
    wasQuote: true,
    // One level deep on purpose: a quoted quote shows its text, never its own embed.
    quotedPost: {
      select: {
        id: true,
        content: true,
        imageKey: true,
        createdAt: true,
        author: { select: userSummarySelect },
      },
    },
    mentions: mentionsSelect,
    hashtags: { select: { tag: true }, orderBy: { tag: 'asc' } },
  } satisfies Prisma.PostSelect;
}

export type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

/** `hidden` are authors the viewer must not see (ADR 0016): their original shows the frame instead. */
function toEmbed(row: PostRow, assetsBase: string, hidden?: ReadonlySet<string>): PostEmbed | null {
  if (row.quotedPost && !hidden?.has(row.quotedPost.author.id)) {
    return {
      id: row.quotedPost.id,
      author: toUserSummary(row.quotedPost.author, assetsBase),
      content: row.quotedPost.content,
      imageUrl:
        row.quotedPost.imageKey === null ? null : `${assetsBase}/${row.quotedPost.imageKey}`,
      createdAt: row.quotedPost.createdAt.toISOString(),
    };
  }
  return row.wasQuote ? { unavailable: true } : null;
}

/**
 * `repost` is set by the feed and profile unions only: who put the post there, and when.
 * `hidden` masks the embed of a quote whose original author the viewer must not see.
 */
export function toPost(
  row: PostRow,
  assetsBase: string,
  repost: Post['repost'] = null,
  hidden?: ReadonlySet<string>,
): Post {
  return {
    id: row.id,
    content: row.content,
    imageUrl: row.imageKey === null ? null : `${assetsBase}/${row.imageKey}`,
    author: toUserSummary(row.author, assetsBase),
    likeCount: row._count.likes,
    commentCount: row._count.comments,
    likedByMe: row.likes.length > 0,
    bookmarkedByMe: row.bookmarks.length > 0,
    repostCount: row.repostCount,
    repostedByMe: row.reposts.length > 0,
    quotedPost: toEmbed(row, assetsBase, hidden),
    repost,
    editedAt: row.editedAt === null ? null : row.editedAt.toISOString(),
    mentions: row.mentions.map((mention) => toUserSummary(mention.user, assetsBase)),
    hashtags: row.hashtags.map((hashtag) => hashtag.tag),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
