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
  extractEntities,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { forbidden, notFound } from '../common/errors.js';
import { emitMentions } from '../common/mentions.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { toRevision } from '../common/revisions.js';
import { PostCreatedEvent, PostLikedEvent, PostUnlikedEvent } from '../events/post.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { UsersService } from '../users/users.service.js';
import { postSelect, toPost } from './posts.mapper.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
  ) {}

  async assertExists(postId: string): Promise<void> {
    const count = await this.prisma.post.count({ where: { id: postId } });
    if (count === 0) throw notFound('Post not found');
  }

  async create(authorId: string, input: CreatePostData): Promise<Post> {
    if (input.imageKey) {
      await this.uploads.assertOwned(input.imageKey, {
        ownerId: authorId,
        kind: 'post',
        field: 'imageKey',
      });
    }
    const createdAt = new Date();
    const entities = extractEntities(input.content);
    const mentioned = await this.users.findByUsernames(entities.mentions);
    const row = await this.prisma.post.create({
      data: {
        authorId,
        content: input.content,
        imageKey: input.imageKey ?? null,
        createdAt,
        mentions: { create: mentioned.map((user) => ({ userId: user.id })) },
        // The tag rows copy the post's timestamp so a tag page pages without a join.
        hashtags: { create: entities.hashtags.map((tag) => ({ tag, createdAt })) },
      },
      select: postSelect(authorId),
    });
    await this.events.emitAsync(PostCreatedEvent.EVENT, new PostCreatedEvent(row.id, authorId));
    await emitMentions(
      this.events,
      authorId,
      mentioned.map((user) => user.id),
      { postId: row.id, commentId: null },
    );
    return toPost(row, this.assets.base);
  }

  async getById(viewerId: string, postId: string): Promise<Post> {
    const row = await this.prisma.post.findUnique({
      where: { id: postId },
      select: postSelect(viewerId),
    });
    if (!row) throw notFound('Post not found');
    return toPost(row, this.assets.base);
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
  async revisions(postId: string): Promise<Paginated<Revision>> {
    await this.assertExists(postId);
    const rows = await this.prisma.postRevision.findMany({
      where: { postId },
      orderBy: [{ editedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return { items: rows.map(toRevision), nextCursor: null };
  }

  /** The viewer's own posts plus those of everyone they follow, newest first. */
  feed(viewerId: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.list(viewerId, query, {
      OR: [{ authorId: viewerId }, { author: { followers: { some: { followerId: viewerId } } } }],
    });
  }

  async byAuthor(viewerId: string, authorId: string, query: CursorQuery): Promise<Paginated<Post>> {
    await this.users.assertExists(authorId);
    return this.list(viewerId, query, { authorId });
  }

  /** Every post carrying `tag` (already lower-cased by the DTO), newest first. */
  byTag(viewerId: string, tag: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.list(viewerId, query, { hashtags: { some: { tag } } });
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
    const matches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM posts
      WHERE search_vector @@ websearch_to_tsquery('simple', ${query.q})
      ${after}
      ORDER BY created_at DESC, id DESC
      LIMIT ${query.limit + 1}`;
    if (matches.length === 0) return { items: [], nextCursor: null };
    const rows = await this.prisma.post.findMany({
      where: { id: { in: matches.map((match) => match.id) } },
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return paginate(rows, query.limit, (row) => toPost(row, this.assets.base));
  }

  async delete(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, imageKey: true },
    });
    if (!post) throw notFound('Post not found');
    if (post.authorId !== viewerId) throw forbidden('You can only delete your own posts');
    await this.prisma.post.delete({ where: { id: postId } });
    await this.uploads.discard(post.imageKey);
  }

  /** Idempotent: liking twice is a no-op and only the first like emits an event. */
  async like(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw notFound('Post not found');
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

  async unlike(viewerId: string, postId: string): Promise<void> {
    await this.assertExists(postId);
    const result = await this.prisma.postLike.deleteMany({ where: { userId: viewerId, postId } });
    if (result.count === 1) {
      await this.events.emitAsync(PostUnlikedEvent.EVENT, new PostUnlikedEvent(postId, viewerId));
    }
  }

  private async list(
    viewerId: string,
    query: CursorQuery,
    where: Prisma.PostWhereInput,
  ): Promise<Paginated<Post>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.post.findMany({
      where: { AND: [where, cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {}] },
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toPost(row, this.assets.base));
  }
}
