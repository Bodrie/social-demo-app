import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type CreatePostData,
  type CursorQuery,
  type Paginated,
  type Post,
  type Revision,
  type SearchQuery,
  type UpdatePostData,
  type UserPostsQuery,
  extractEntities,
  EXPLORE_POPULAR_DAYS,
  POLL_DURATION_HOURS,
  type ExploreQuery,
} from '@beso/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest, forbidden, notFound } from '../common/errors.js';
import { emitMentions } from '../common/mentions.js';
import {
  decodeCursor,
  decodeRankedCursor,
  encodeRankedCursor,
  keysetAfter,
  paginate,
  paginateBy,
  paginateWith,
} from '../common/pagination.js';
import { revisionKey, revisionsAfter, toRevision } from '../common/revisions.js';
import {
  PostBookmarkedEvent,
  PostCreatedEvent,
  PostEditedEvent,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepostedEvent,
  PostUnlikedEvent,
  PostUnrepostedEvent,
} from '../events/post.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';
import { UsersService } from '../users/users.service.js';
import { postSelect, toPost } from './posts.mapper.js';

type Occurrence = { post_id: string; sort_at: Date; repost_id: string | null };

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  async assertExists(postId: string): Promise<void> {
    const count = await this.prisma.post.count({ where: { id: postId } });
    if (count === 0) throw notFound('Post not found');
  }

  async create(authorId: string, input: CreatePostData): Promise<Post> {
    // A tab opened before D2 sends its one picture as `imageKey`.
    const field = input.imageKeys ? 'imageKeys' : 'imageKey';
    const imageKeys = input.imageKeys ?? (input.imageKey ? [input.imageKey] : []);
    await this.uploads.assertAllOwned(imageKeys, { ownerId: authorId, kind: 'post', field });
    // A quote is a post of its own that embeds another (ADR 0017); the original must exist now,
    // later it may go and leave the frame behind.
    let quoted: { id: string; authorId: string } | null = null;
    if (input.quotedPostId) {
      quoted = await this.prisma.post.findUnique({
        where: { id: input.quotedPostId },
        select: { id: true, authorId: true },
      });
      if (!quoted) throw badRequest('Unknown post', { quotedPostId: 'Unknown post' });
      await this.visibility.assertNotBlocked(authorId, quoted.authorId);
    }
    const createdAt = new Date();
    const entities = extractEntities(input.content);
    const mentioned = await this.users.findByUsernames(entities.mentions);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId,
          content: input.content,
          images: { create: imageKeys.map((key, position) => ({ key, position })) },
          quotedPostId: quoted?.id ?? null,
          wasQuote: quoted !== null,
          createdAt,
          mentions: { create: mentioned.map((user) => ({ userId: user.id })) },
          // The tag rows copy the post's timestamp so a tag page pages without a join.
          hashtags: { create: entities.hashtags.map((tag) => ({ tag, createdAt })) },
          // Fixed from here on (F3); the schema refused it with pictures or in a quote.
          poll: input.poll
            ? {
                create: {
                  closesAt: new Date(
                    createdAt.getTime() + POLL_DURATION_HOURS[input.poll.duration] * HOUR_MS,
                  ),
                  options: {
                    create: input.poll.options.map((text, position) => ({ text, position })),
                  },
                },
              }
            : undefined,
        },
        select: postSelect(authorId),
      });
      if (quoted) {
        await tx.post.update({
          where: { id: quoted.id },
          data: { repostCount: { increment: 1 } },
        });
      }
      return created;
    });
    // A quote is told about as a quote, not as "published a post" as well.
    if (quoted) {
      await this.events.emitAsync(
        PostQuotedEvent.EVENT,
        new PostQuotedEvent(row.id, quoted.id, authorId, quoted.authorId),
      );
    } else {
      await this.events.emitAsync(PostCreatedEvent.EVENT, new PostCreatedEvent(row.id, authorId));
    }
    await emitMentions(
      this.events,
      authorId,
      mentioned.map((user) => user.id),
      { postId: row.id, commentId: null },
    );
    return toPost(row, this.assets.base, authorId);
  }

  /** A post of someone on either side of a block with the viewer does not exist for them (ADR 0016). */
  async getById(viewerId: string, postId: string): Promise<Post> {
    const row = await this.prisma.post.findUnique({
      where: { id: postId },
      select: postSelect(viewerId),
    });
    if (!row) throw notFound('Post not found');
    const blocked = await this.visibility.blockedIds(viewerId);
    if (row.author.id !== viewerId && blocked.includes(row.author.id)) {
      throw notFound('Post not found');
    }
    return toPost(row, this.assets.base, viewerId, { hidden: await this.hiddenFor(viewerId) });
  }

  /** Authors the viewer must not see, as a set for the mapper's embed masking. */
  private async hiddenFor(viewerId: string): Promise<ReadonlySet<string>> {
    return new Set(await this.visibility.hiddenAuthorIds(viewerId));
  }

  /**
   * Author only. The previous text is kept as a revision; an unchanged text is a no-op.
   * Mentions and tags are re-parsed from the new text; only members mentioned for the
   * first time are told.
   */
  async update(viewerId: string, postId: string, input: UpdatePostData): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorId: true,
        content: true,
        createdAt: true,
        mentions: { select: { userId: true } },
      },
    });
    if (!post) throw notFound('Post not found');
    if (post.authorId !== viewerId) throw forbidden('You can only edit your own posts');
    if (post.content !== input.content) {
      const entities = extractEntities(input.content);
      const mentioned = await this.users.findByUsernames(entities.mentions);
      await this.prisma.$transaction([
        this.prisma.postRevision.create({ data: { postId, content: post.content } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { content: input.content, editedAt: new Date() },
        }),
        this.prisma.postMention.deleteMany({ where: { postId } }),
        this.prisma.postMention.createMany({
          data: mentioned.map((user) => ({ postId, userId: user.id })),
        }),
        this.prisma.postHashtag.deleteMany({ where: { postId } }),
        this.prisma.postHashtag.createMany({
          data: entities.hashtags.map((tag) => ({ postId, tag, createdAt: post.createdAt })),
        }),
      ]);
      await this.events.emitAsync(PostEditedEvent.EVENT, new PostEditedEvent(postId, viewerId));
      const before = new Set(post.mentions.map((mention) => mention.userId));
      await emitMentions(
        this.events,
        viewerId,
        mentioned.filter((user) => !before.has(user.id)).map((user) => user.id),
        { postId, commentId: null },
      );
    }
    return this.getById(viewerId, postId);
  }

  /** Previous versions, most recently replaced first. Visible to anyone who can see the post. */
  async revisions(postId: string, query: CursorQuery): Promise<Paginated<Revision>> {
    await this.assertExists(postId);
    const rows = await this.prisma.postRevision.findMany({
      where: { postId, ...revisionsAfter(decodeCursor(query.cursor)) },
      orderBy: [{ editedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(rows, query.limit, revisionKey, toRevision);
  }

  /**
   * The viewer's own posts and plain reposts plus those of everyone they follow, as one list
   * ordered by the time each post last turned up (ADR 0017).
   */
  async feed(viewerId: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.union(
      viewerId,
      Prisma.sql`SELECT ${viewerId}::uuid AS id UNION SELECT followee_id FROM follows WHERE follower_id = ${viewerId}::uuid`,
      query,
      await this.visibility.hiddenAuthorIds(viewerId),
    );
  }

  /**
   * A member's posts, with their plain reposts in between (the profile) or alone. Across a
   * block the list is empty; a muted member's own page still shows their posts (the viewer
   * went there), only what they reposted of people the viewer blocked is left out.
   */
  async byAuthor(
    viewerId: string,
    authorId: string,
    query: UserPostsQuery,
  ): Promise<Paginated<Post>> {
    await this.users.assertExists(authorId);
    const hidden = await this.visibility.blockedIds(viewerId);
    if (authorId !== viewerId && hidden.includes(authorId)) return { items: [], nextCursor: null };
    if (query.include === 'own') return this.list(viewerId, query, { authorId }, hidden);
    return this.union(viewerId, Prisma.sql`SELECT ${authorId}::uuid AS id`, query, hidden);
  }

  /**
   * Posts and plain reposts of a set of members as one list: a post appears once, at the time
   * of its newest occurrence (the post itself or the latest repost by one of them), with that
   * reposter on it; the cursor is `(sort_at, post_id)`. The ids come from SQL (Prisma has no
   * union), the rows from the normal select so the shape is the feed's.
   */
  private async union(
    viewerId: string,
    members: Prisma.Sql,
    query: CursorQuery,
    hidden: string[],
  ): Promise<Paginated<Post>> {
    const cursor = decodeCursor(query.cursor);
    const after = cursor
      ? Prisma.sql`WHERE (sort_at, post_id) < (${cursor.createdAt}, ${cursor.id}::uuid)`
      : Prisma.empty;
    // Nothing by a hidden author, nor reposted by one, nor a repost of one's post (ADR 0016).
    const picked = await this.prisma.$queryRaw<Occurrence[]>`
      WITH members AS (${members}),
      occurrences AS (
        SELECT p.id AS post_id, p.created_at AS sort_at, NULL::uuid AS repost_id
        FROM posts p
        WHERE p.author_id IN (SELECT id FROM members)
          AND NOT (p.author_id = ANY(${hidden}::uuid[]))
        UNION ALL
        SELECT r.post_id, r.created_at, r.id
        FROM reposts r
        WHERE r.user_id IN (SELECT id FROM members)
          AND NOT (r.user_id = ANY(${hidden}::uuid[]))
          AND NOT EXISTS (
            SELECT 1 FROM posts hp WHERE hp.id = r.post_id AND hp.author_id = ANY(${hidden}::uuid[]))
      ),
      newest AS (
        SELECT DISTINCT ON (post_id) post_id, sort_at, repost_id
        FROM occurrences ORDER BY post_id, sort_at DESC, repost_id DESC NULLS LAST
      )
      SELECT post_id, sort_at, repost_id FROM newest ${after}
      ORDER BY sort_at DESC, post_id DESC
      LIMIT ${query.limit + 1}`;
    if (picked.length === 0) return { items: [], nextCursor: null };
    const [rows, reposts] = await Promise.all([
      this.prisma.post.findMany({
        where: { id: { in: picked.map((item) => item.post_id) } },
        select: postSelect(viewerId),
      }),
      this.prisma.repost.findMany({
        where: { id: { in: picked.flatMap((item) => (item.repost_id ? [item.repost_id] : [])) } },
        select: { id: true, createdAt: true, user: { select: userSummarySelect } },
      }),
    ]);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const repostById = new Map(reposts.map((repost) => [repost.id, repost]));
    const items = picked.flatMap((item) => {
      const row = rowById.get(item.post_id);
      if (!row) return [];
      const repost = item.repost_id ? repostById.get(item.repost_id) : undefined;
      return [
        {
          sortAt: item.sort_at,
          row,
          repost: repost
            ? {
                by: toUserSummary(repost.user, this.assets.base),
                at: repost.createdAt.toISOString(),
              }
            : null,
        },
      ];
    });
    const hiddenSet = new Set(hidden);
    return paginateBy(
      items,
      query.limit,
      (item) => ({ createdAt: item.sortAt, id: item.row.id }),
      (item) =>
        toPost(item.row, this.assets.base, viewerId, { repost: item.repost, hidden: hiddenSet }),
    );
  }

  /** Every post carrying `tag` (already lower-cased by the DTO), newest first. */
  async byTag(viewerId: string, tag: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.list(
      viewerId,
      query,
      { hashtags: { some: { tag } } },
      await this.visibility.hiddenAuthorIds(viewerId),
    );
  }

  /**
   * Explore (F1): everyone's posts and quotes (no plain reposts), without those of people
   * hidden from the viewer. `latest` newest first; `popular` the last
   * `EXPLORE_POPULAR_DAYS` by likes + 2 × comments + reposts and quotes, then newest, paged
   * with a ranked cursor (scores move while someone pages, as with comments' top sort).
   */
  async explore(viewerId: string, query: ExploreQuery): Promise<Paginated<Post>> {
    const hidden = await this.visibility.hiddenAuthorIds(viewerId);
    if (query.sort === 'latest') return this.list(viewerId, query, {}, hidden);

    const cursor = decodeRankedCursor(query.cursor);
    const since = new Date(Date.now() - EXPLORE_POPULAR_DAYS * 24 * 60 * 60 * 1000);
    const after = cursor
      ? Prisma.sql`WHERE score < ${cursor.score}
          OR (score = ${cursor.score} AND (created_at < ${cursor.createdAt}
            OR (created_at = ${cursor.createdAt} AND id < ${cursor.id}::uuid)))`
      : Prisma.empty;
    const ranked = await this.prisma.$queryRaw<{ id: string; created_at: Date; score: number }[]>`
      SELECT id, created_at, score FROM (
        SELECT p.id, p.created_at,
          ((SELECT count(*) FROM post_likes AS l WHERE l.post_id = p.id)
            + 2 * (SELECT count(*) FROM comments AS c WHERE c.post_id = p.id)
            + p.repost_count)::int AS score
        FROM posts AS p
        WHERE p.created_at > ${since}
          AND NOT (p.author_id = ANY(${hidden}::uuid[]))
      ) AS scored
      ${after}
      ORDER BY score DESC, created_at DESC, id DESC
      LIMIT ${query.limit + 1}`;
    if (ranked.length === 0) return { items: [], nextCursor: null };
    const rows = await this.prisma.post.findMany({
      where: { id: { in: ranked.map((row) => row.id) } },
      select: postSelect(viewerId),
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const hiddenSet = new Set(hidden);
    // A post deleted between the two queries simply drops out of the page.
    const ordered = ranked.flatMap((rank) => {
      const row = byId.get(rank.id);
      return row ? [{ rank, row }] : [];
    });
    return paginateWith(
      ordered,
      query.limit,
      ({ rank }) =>
        encodeRankedCursor({ score: rank.score, createdAt: rank.created_at, id: rank.id }),
      ({ row }) => toPost(row, this.assets.base, viewerId, { hidden: hiddenSet }),
    );
  }

  /**
   * Full-text search over the content: `search_vector` is a generated column (ADR 0014),
   * matched with `websearch_to_tsquery` so quotes, `or` and `-word` work as people expect.
   * Newest first with the usual keyset; the ids come from raw SQL (Prisma has no `@@`), the
   * rows from the normal select so the shape is the feed's.
   */
  async search(viewerId: string, query: SearchQuery): Promise<Paginated<Post>> {
    const cursor = decodeCursor(query.cursor);
    const after = cursor
      ? Prisma.sql`AND (created_at < ${cursor.createdAt} OR (created_at = ${cursor.createdAt} AND id < ${cursor.id}::uuid))`
      : Prisma.empty;
    const hidden = await this.visibility.hiddenAuthorIds(viewerId);
    const matches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM posts
      WHERE search_vector @@ websearch_to_tsquery('simple', ${query.q})
        AND NOT (author_id = ANY(${hidden}::uuid[]))
      ${after}
      ORDER BY created_at DESC, id DESC
      LIMIT ${query.limit + 1}`;
    if (matches.length === 0) return { items: [], nextCursor: null };
    const rows = await this.prisma.post.findMany({
      where: { id: { in: matches.map((match) => match.id) } },
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const hiddenSet = new Set(hidden);
    return paginate(rows, query.limit, (row) =>
      toPost(row, this.assets.base, viewerId, { hidden: hiddenSet }),
    );
  }

  /** The author's own, or an admin's from the reports queue (`asAdmin`, ADR 0016). */
  async delete(
    viewerId: string,
    postId: string,
    options: { asAdmin?: boolean } = {},
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, quotedPostId: true, images: { select: { key: true } } },
    });
    if (!post) throw notFound('Post not found');
    if (!options.asAdmin && post.authorId !== viewerId) {
      throw forbidden('You can only delete your own posts');
    }
    await this.prisma.$transaction([
      this.prisma.post.delete({ where: { id: postId } }),
      // A quote counted on its original; the original may be gone already (updateMany: no throw).
      ...(post.quotedPostId
        ? [
            this.prisma.post.updateMany({
              where: { id: post.quotedPostId },
              data: { repostCount: { decrement: 1 } },
            }),
          ]
        : []),
    ]);
    await Promise.all(post.images.map((image) => this.uploads.discard(image.key)));
  }

  /**
   * A plain repost (ADR 0017): one per member and post, never of one's own post, counted on
   * the post, told to its author. A repost of a quote reposts the quote (it is a post).
   */
  async repost(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw notFound('Post not found');
    if (post.authorId === viewerId) throw badRequest('You cannot repost your own post');
    await this.visibility.assertNotBlocked(viewerId, post.authorId);
    const created = await this.prisma.$transaction(async (tx) => {
      const result = await tx.repost.createMany({
        data: { userId: viewerId, postId },
        skipDuplicates: true,
      });
      if (result.count === 1) {
        await tx.post.update({ where: { id: postId }, data: { repostCount: { increment: 1 } } });
      }
      return result.count === 1;
    });
    if (created) {
      await this.events.emitAsync(
        PostRepostedEvent.EVENT,
        new PostRepostedEvent(postId, viewerId, post.authorId),
      );
    }
  }

  async unrepost(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    const removed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.repost.deleteMany({ where: { userId: viewerId, postId } });
      if (result.count === 1) {
        await tx.post.update({ where: { id: postId }, data: { repostCount: { decrement: 1 } } });
      }
      return result.count === 1;
    });
    if (removed) {
      await this.events.emitAsync(
        PostUnrepostedEvent.EVENT,
        new PostUnrepostedEvent(postId, viewerId),
      );
    }
  }

  /** Idempotent: liking twice is a no-op and only the first like emits an event. */
  async like(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw notFound('Post not found');
    await this.visibility.assertNotBlocked(viewerId, post.authorId);
    const result = await this.prisma.postLike.createMany({
      data: { userId: viewerId, postId },
      skipDuplicates: true,
    });
    if (result.count === 1) {
      await this.events.emitAsync(
        PostLikedEvent.EVENT,
        new PostLikedEvent(postId, viewerId, post.authorId),
      );
    }
  }

  /** The author's one pinned post, shown first on their profile; pinning another replaces it. */
  async pin(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw notFound('Post not found');
    if (post.authorId !== viewerId) throw forbidden('Only the author can pin a post');
    await this.prisma.user.update({ where: { id: viewerId }, data: { pinnedPostId: postId } });
  }

  /** Only that post comes off; another one pinned since stays. Idempotent. */
  async unpin(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    await this.prisma.user.updateMany({
      where: { id: viewerId, pinnedPostId: postId },
      data: { pinnedPostId: null },
    });
  }

  async unlike(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    const result = await this.prisma.postLike.deleteMany({ where: { userId: viewerId, postId } });
    if (result.count === 1) {
      await this.events.emitAsync(PostUnlikedEvent.EVENT, new PostUnlikedEvent(postId, viewerId));
    }
  }

  /** A private save-for-later (C3a): idempotent, no count on the post, no event, nobody told. */
  async bookmark(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    const { count } = await this.prisma.bookmark.createMany({
      data: { userId: viewerId, postId },
      skipDuplicates: true,
    });
    if (count === 1) {
      await this.events.emitAsync(
        PostBookmarkedEvent.EVENT,
        new PostBookmarkedEvent(postId, viewerId),
      );
    }
  }

  async unbookmark(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    await this.prisma.bookmark.deleteMany({ where: { userId: viewerId, postId } });
  }

  /** The viewer's saved posts, newest save first: the keyset is the bookmark's time, not the post's. */
  async bookmarks(viewerId: string, query: CursorQuery): Promise<Paginated<Post>> {
    const cursor = decodeCursor(query.cursor);
    const hidden = await this.visibility.hiddenAuthorIds(viewerId);
    const rows = await this.prisma.bookmark.findMany({
      where: {
        AND: [
          { userId: viewerId, post: { authorId: { notIn: hidden } } },
          cursor ? keysetAfter(cursor, (id) => ({ postId: { lt: id } })) : {},
        ],
      },
      select: { createdAt: true, postId: true, post: { select: postSelect(viewerId) } },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: query.limit + 1,
    });
    const hiddenSet = new Set(hidden);
    return paginateBy(
      rows,
      query.limit,
      (row) => ({ createdAt: row.createdAt, id: row.postId }),
      (row) => toPost(row.post, this.assets.base, viewerId, { hidden: hiddenSet }),
    );
  }

  private async list(
    viewerId: string,
    query: CursorQuery,
    where: Prisma.PostWhereInput,
    hidden: string[],
  ): Promise<Paginated<Post>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.post.findMany({
      where: {
        AND: [
          where,
          { authorId: { notIn: hidden } },
          cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {},
        ],
      },
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hiddenSet = new Set(hidden);
    return paginate(rows, query.limit, (row) =>
      toPost(row, this.assets.base, viewerId, { hidden: hiddenSet }),
    );
  }
}
