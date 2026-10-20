import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type Comment,
  type CommentsQuery,
  type CreateCommentData,
  type CursorQuery,
  type Paginated,
  type ReactionSummary,
  type ReactionType,
  type Revision,
  type UpdateCommentData,
  extractEntities,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { forbidden, notFound } from '../common/errors.js';
import { emitMentions } from '../common/mentions.js';
import {
  decodeCursor,
  decodeRankedCursor,
  encodeCursor,
  encodeRankedCursor,
  keysetAfter,
  paginateBy,
  paginateWith,
} from '../common/pagination.js';
import { revisionKey, revisionsAfter, toRevision } from '../common/revisions.js';
import { CommentCreatedEvent, CommentReactedEvent } from '../events/comment.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import {
  type CommentRow,
  type ReactionCounts,
  commentSelect,
  emptyCounts,
  isReactionType,
  toComment,
  toReactionSummary,
} from './comments.mapper.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * `newest`: newest first, so a fresh comment appears right under the input.
   * `top`: most reactions first (ties newest first); the cursor carries the score too.
   */
  async listForPost(
    viewerId: string,
    postId: string,
    query: CommentsQuery,
  ): Promise<Paginated<Comment>> {
    await this.posts.assertExists(postId);
    const select = commentSelect(viewerId);
    const take = query.limit + 1;
    // Either side of a block sees nothing the other wrote (ADR 0016); mutes leave comments alone.
    const hidden: Prisma.CommentWhereInput = {
      authorId: { notIn: await this.visibility.blockedIds(viewerId) },
    };

    if (query.sort === 'top') {
      const cursor = decodeRankedCursor(query.cursor);
      const after: Prisma.CommentWhereInput = cursor
        ? {
            OR: [
              { reactionsCount: { lt: cursor.score } },
              { reactionsCount: cursor.score, createdAt: { lt: cursor.createdAt } },
              { reactionsCount: cursor.score, createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {};
      const rows = await this.prisma.comment.findMany({
        where: { AND: [{ postId }, hidden, after] },
        select,
        orderBy: [{ reactionsCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take,
      });
      const counts = await this.countsFor(rows.map((row) => row.id));
      return paginateWith(
        rows,
        query.limit,
        (row) =>
          encodeRankedCursor({ score: row.reactionsCount, createdAt: row.createdAt, id: row.id }),
        (row) => this.map(row, counts),
      );
    }

    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.comment.findMany({
      where: {
        AND: [{ postId }, hidden, cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {}],
      },
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
    const counts = await this.countsFor(rows.map((row) => row.id));
    return paginateWith(
      rows,
      query.limit,
      (row) => encodeCursor({ createdAt: row.createdAt, id: row.id }),
      (row) => this.map(row, counts),
    );
  }

  async create(authorId: string, postId: string, input: CreateCommentData): Promise<Comment> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw notFound('Post not found');
    await this.visibility.assertNotBlocked(authorId, post.authorId);

    const mentioned = await this.users.findByUsernames(extractEntities(input.content).mentions);
    const row = await this.prisma.comment.create({
      data: {
        postId,
        authorId,
        content: input.content,
        mentions: { create: mentioned.map((user) => ({ userId: user.id })) },
      },
      select: commentSelect(authorId),
    });
    await this.events.emitAsync(
      CommentCreatedEvent.EVENT,
      new CommentCreatedEvent(row.id, postId, authorId, post.authorId),
    );
    await emitMentions(
      this.events,
      authorId,
      mentioned.map((user) => user.id),
      { postId, commentId: row.id },
    );
    return toComment(row, emptyCounts(), this.assets.base);
  }

  /**
   * Author only. The previous text is kept as a revision; an unchanged text is a no-op.
   * Mentions are re-parsed; only members mentioned for the first time are told.
   */
  async update(viewerId: string, commentId: string, input: UpdateCommentData): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        content: true,
        postId: true,
        mentions: { select: { userId: true } },
      },
    });
    if (!comment) throw notFound('Comment not found');
    if (comment.authorId !== viewerId) throw forbidden('You can only edit your own comments');
    if (comment.content !== input.content) {
      const mentioned = await this.users.findByUsernames(extractEntities(input.content).mentions);
      await this.prisma.$transaction([
        this.prisma.commentRevision.create({ data: { commentId, content: comment.content } }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { content: input.content, editedAt: new Date() },
        }),
        this.prisma.commentMention.deleteMany({ where: { commentId } }),
        this.prisma.commentMention.createMany({
          data: mentioned.map((user) => ({ commentId, userId: user.id })),
        }),
      ]);
      const before = new Set(comment.mentions.map((mention) => mention.userId));
      await emitMentions(
        this.events,
        viewerId,
        mentioned.filter((user) => !before.has(user.id)).map((user) => user.id),
        { postId: comment.postId, commentId },
      );
    }
    return this.getById(viewerId, commentId);
  }

  /** Previous versions, most recently replaced first. */
  async revisions(commentId: string, query: CursorQuery): Promise<Paginated<Revision>> {
    await this.assertExists(commentId);
    const rows = await this.prisma.commentRevision.findMany({
      where: { commentId, ...revisionsAfter(decodeCursor(query.cursor)) },
      orderBy: [{ editedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(rows, query.limit, revisionKey, toRevision);
  }

  /**
   * Sets (or switches) the viewer's reaction. Idempotent for the same type; only the first
   * reaction of a person on a comment is an event (notifications), a switch is not.
   */
  async react(viewerId: string, commentId: string, type: ReactionType): Promise<ReactionSummary> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { postId: true, authorId: true },
    });
    if (!comment) throw notFound('Comment not found');
    await this.visibility.assertNotBlocked(viewerId, comment.authorId);
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { commentId_userId: { commentId, userId: viewerId } },
        select: { type: true },
      });
      if (!existing) {
        await tx.commentReaction.create({ data: { commentId, userId: viewerId, type } });
        await tx.comment.update({
          where: { id: commentId },
          data: { reactionsCount: { increment: 1 } },
        });
        return true;
      }
      if (existing.type !== type) {
        await tx.commentReaction.update({
          where: { commentId_userId: { commentId, userId: viewerId } },
          data: { type },
        });
      }
      return false;
    });
    if (created) {
      await this.events.emitAsync(
        CommentReactedEvent.EVENT,
        new CommentReactedEvent(commentId, comment.postId, viewerId, comment.authorId),
      );
    }
    return this.summary(viewerId, commentId);
  }

  /** Removes the viewer's reaction, if any. */
  async unreact(viewerId: string, commentId: string): Promise<ReactionSummary> {
    await this.assertExists(commentId);
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.commentReaction.deleteMany({
        where: { commentId, userId: viewerId },
      });
      if (removed.count === 1) {
        await tx.comment.update({
          where: { id: commentId },
          data: { reactionsCount: { decrement: 1 } },
        });
      }
    });
    return this.summary(viewerId, commentId);
  }

  /** The comment's author and the post's author may delete a comment. */
  async delete(viewerId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, post: { select: { authorId: true } } },
    });
    if (!comment) throw notFound('Comment not found');
    if (viewerId !== comment.authorId && viewerId !== comment.post.authorId) {
      throw forbidden('Only the comment author or the post author can delete a comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private async assertExists(commentId: string): Promise<void> {
    const count = await this.prisma.comment.count({ where: { id: commentId } });
    if (count === 0) throw notFound('Comment not found');
  }

  /** One comment by id; any member may read any comment (posts are visible to every member). */
  async getById(viewerId: string, commentId: string): Promise<Comment> {
    const row = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: commentSelect(viewerId),
    });
    if (!row) throw notFound('Comment not found');
    const counts = await this.countsFor([row.id]);
    return this.map(row, counts);
  }

  private async summary(viewerId: string, commentId: string): Promise<ReactionSummary> {
    const row = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        reactionsCount: true,
        reactions: { where: { userId: viewerId }, select: { type: true } },
      },
    });
    if (!row) throw notFound('Comment not found');
    const counts = await this.countsFor([commentId]);
    return toReactionSummary(
      counts.get(commentId) ?? emptyCounts(),
      row.reactionsCount,
      row.reactions[0]?.type ?? null,
    );
  }

  /** Per-type reaction counts for a page of comments, in one grouped query. */
  private async countsFor(commentIds: string[]): Promise<Map<string, ReactionCounts>> {
    const counts = new Map<string, ReactionCounts>();
    if (commentIds.length === 0) return counts;
    const groups = await this.prisma.commentReaction.groupBy({
      by: ['commentId', 'type'],
      where: { commentId: { in: commentIds } },
      _count: true,
    });
    for (const group of groups) {
      if (!isReactionType(group.type)) continue;
      const entry = counts.get(group.commentId) ?? emptyCounts();
      entry[group.type] = group._count;
      counts.set(group.commentId, entry);
    }
    return counts;
  }

  private map(row: CommentRow, counts: Map<string, ReactionCounts>): Comment {
    return toComment(row, counts.get(row.id) ?? emptyCounts(), this.assets.base);
  }
}
