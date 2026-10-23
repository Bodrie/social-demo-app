import type { Post, PostEmbed } from '@beso/shared';
import type { Prisma } from '../generated/prisma/client.js';
import {
  type StoredImageRow,
  storedImageSelect,
  toStoredImage,
} from '../uploads/uploads.mapper.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

/** Mentioned members, resolved at read time so a renamed member still links to the right profile. */
export const mentionsSelect = {
  select: { user: { select: userSummarySelect } },
  orderBy: { user: { username: 'asc' } },
} as const;

/** The pictures of a post in the author's order, each with its size (D2). */
const imagesSelect = {
  select: { upload: { select: storedImageSelect } },
  orderBy: { position: 'asc' },
} as const;

/** A poll's options with their counts, and the viewer's own vote (F3). */
function pollSelect(viewerId: string) {
  return {
    select: {
      closesAt: true,
      options: {
        select: { id: true, text: true, _count: { select: { votes: true } } },
        orderBy: { position: 'asc' },
      },
      votes: { where: { userId: viewerId }, select: { optionId: true } },
    },
  } as const;
}

/** Everything a feed item needs, in one query: author, counts, entities, the embed and the viewer's flags. */
export function postSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    images: imagesSelect,
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
        images: imagesSelect,
        createdAt: true,
        author: { select: userSummarySelect },
        poll: { select: { postId: true } },
      },
    },
    poll: pollSelect(viewerId),
    achievementKey: true,
    mentions: mentionsSelect,
    hashtags: { select: { tag: true }, orderBy: { tag: 'asc' } },
  } satisfies Prisma.PostSelect;
}

export type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

/** The pictures plus the single URL tabs opened before D2 still read. */
function toImages(rows: { upload: StoredImageRow }[], assetsBase: string) {
  const images = rows.map((row) => toStoredImage(row.upload, assetsBase));
  return { images, imageUrl: images[0]?.url ?? null };
}

/** `hidden` are authors the viewer must not see (ADR 0016): their original shows the frame instead. */
function toEmbed(row: PostRow, assetsBase: string, hidden?: ReadonlySet<string>): PostEmbed | null {
  if (row.quotedPost && !hidden?.has(row.quotedPost.author.id)) {
    return {
      id: row.quotedPost.id,
      author: toUserSummary(row.quotedPost.author, assetsBase),
      content: row.quotedPost.content,
      ...toImages(row.quotedPost.images, assetsBase),
      hasPoll: row.quotedPost.poll !== null,
      createdAt: row.quotedPost.createdAt.toISOString(),
    };
  }
  return row.wasQuote ? { unavailable: true } : null;
}

/**
 * The counts only for whom P3 allows them before the close: the viewer who voted and the
 * author. Everyone sees how many voted.
 */
function toPoll(row: PostRow, viewerId: string, now: Date): Post['poll'] {
  const { poll } = row;
  if (!poll) return null;
  const closed = poll.closesAt <= now;
  const myVote = poll.votes[0]?.optionId ?? null;
  const visible = closed || myVote !== null || row.author.id === viewerId;
  return {
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      votes: visible ? option._count.votes : null,
    })),
    totalVotes: poll.options.reduce((total, option) => total + option._count.votes, 0),
    myVote,
    closesAt: poll.closesAt.toISOString(),
    closed,
  };
}

export type ToPostOptions = {
  /** Set by the feed and profile unions only: who put the post there, and when. */
  repost?: Post['repost'];
  /** Authors the viewer must not see: a quote of theirs shows the frame instead of the embed. */
  hidden?: ReadonlySet<string>;
  now?: Date;
};

/** `viewerId` is whom the row was selected for (`postSelect`): their flags, their poll view. */
export function toPost(
  row: PostRow,
  assetsBase: string,
  viewerId: string,
  { repost = null, hidden, now = new Date() }: ToPostOptions = {},
): Post {
  return {
    id: row.id,
    content: row.content,
    ...toImages(row.images, assetsBase),
    author: toUserSummary(row.author, assetsBase),
    likeCount: row._count.likes,
    commentCount: row._count.comments,
    likedByMe: row.likes.length > 0,
    bookmarkedByMe: row.bookmarks.length > 0,
    repostCount: row.repostCount,
    repostedByMe: row.reposts.length > 0,
    quotedPost: toEmbed(row, assetsBase, hidden),
    poll: toPoll(row, viewerId, now),
    achievement: row.achievementKey,
    repost,
    editedAt: row.editedAt === null ? null : row.editedAt.toISOString(),
    mentions: row.mentions.map((mention) => toUserSummary(mention.user, assetsBase)),
    hashtags: row.hashtags.map((hashtag) => hashtag.tag),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
