import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Comment, CreateCommentData, CursorQuery, Paginated } from '@the-mesh/shared';
import { decodeCursor, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { CommentCreatedEvent } from '../events/comment.events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { commentSelect, toComment } from './comments.mapper.js';

@Injectable()
export class CommentsService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  /** Newest first, so a freshly written comment appears right under the input. */
  async listForPost(postId: string, query: CursorQuery): Promise<Paginated<Comment>> {
    await this.assertPostExists(postId);
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      select: commentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    return paginate(rows, query.limit, (row) => toComment(row, this.assetsBase));
  }

  async create(authorId: string, postId: string, input: CreateCommentData): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) throw this.postNotFound();

    const row = await this.prisma.comment.create({
      data: { postId, authorId, content: input.content },
      select: commentSelect,
    });
    await this.events.emitAsync(
      CommentCreatedEvent.EVENT,
      new CommentCreatedEvent(row.id, postId, authorId, post.authorId),
    );
    return toComment(row, this.assetsBase);
  }

  /** The comment's author and the post's author may delete a comment. */
  async delete(viewerId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, post: { select: { authorId: true } } },
    });
    if (!comment) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Comment not found' });
    }
    if (viewerId !== comment.authorId && viewerId !== comment.post.authorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the comment author or the post author can delete a comment',
      });
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private async assertPostExists(postId: string): Promise<void> {
    const count = await this.prisma.post.count({ where: { id: postId } });
    if (count === 0) throw this.postNotFound();
  }

  private postNotFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'Post not found' });
  }
}
