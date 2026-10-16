import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  Comment,
  CommentsQuery,
  CreateCommentData,
  Paginated,
  ReactionSummary,
  ReactionType,
  Revision,
  UpdateCommentData,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { forbidden, notFound } from '../common/errors.js';
import {
  decodeCursor,
  decodeRankedCursor,
  encodeCursor,
  encodeRankedCursor,
  keysetAfter,
  paginateWith,
} from '../common/pagination.js';
import { toRevision } from '../common/revisions.js';
import { CommentCreatedEvent } from '../events/comment.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
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
        where: { AND: [{ postId }, after] },
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
      where: { AND: [{ postId }, cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {}] },
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

    const row = await this.prisma.comment.create({
      data: { postId, authorId, content: input.content },
      select: commentSelect(authorId),
    });
    await this.events.emitAsync(
      CommentCreatedEvent.EVENT,
      new CommentCreatedEvent(row.id, postId, authorId, post.authorId),
    );
    return toComment(row, emptyCounts(), this.assets.base);
  }

  /** Author only. The previous text is kept as a revision; an unchanged text is a no-op. */
  async update(viewerId: string, commentId: string, input: UpdateCommentData): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, content: true },
    });
    if (!comment) throw notFound('Comment not found');
    if (comment.authorId !== viewerId) throw forbidden('You can only edit your own comments');
    if (comment.content !== input.content) {
      await this.prisma.$transaction([
        this.prisma.commentRevision.create({ data: { commentId, content: comment.content } }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { content: input.content, editedAt: new Date() },
        }),
      ]);
    }
    return this.getById(viewerId, commentId);
  }

  /** Previous versions, most recently replaced first. */
  async revisions(commentId: string): Promise<Paginated<Revision>> {
    await this.assertExists(commentId);
    const rows = await this.prisma.commentRevision.findMany({
      where: { commentId },
      orderBy: [{ editedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return { items: rows.map(toRevision), nextCursor: null };
  }

  /** Sets (or switches) the viewer's reaction. Idempotent for the same type. */
  async react(viewerId: string, commentId: string, type: ReactionType): Promise<ReactionSummary> {
    await this.assertExists(commentId);
    await this.prisma.$transaction(async (tx) => {
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
      } else if (existing.type !== type) {
        await tx.commentReaction.update({
          where: { commentId_userId: { commentId, userId: viewerId } },
          data: { type },
        });
      }
    });
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

  private async getById(viewerId: string, commentId: string): Promise<Comment> {
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
