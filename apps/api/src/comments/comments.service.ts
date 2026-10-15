import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Comment, CreateCommentData, CursorQuery, Paginated } from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { forbidden, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { CommentCreatedEvent } from '../events/comment.events.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { commentSelect, toComment } from './comments.mapper.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
  ) {}

  /** Newest first, so a freshly written comment appears right under the input. */
  async listForPost(postId: string, query: CursorQuery): Promise<Paginated<Comment>> {
    await this.posts.assertExists(postId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.comment.findMany({
      where: { AND: [{ postId }, cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {}] },
      select: commentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toComment(row, this.assets.base));
  }

  async create(authorId: string, postId: string, input: CreateCommentData): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) throw notFound('Post not found');

    const row = await this.prisma.comment.create({
      data: { postId, authorId, content: input.content },
      select: commentSelect,
    });
    await this.events.emitAsync(
      CommentCreatedEvent.EVENT,
      new CommentCreatedEvent(row.id, postId, authorId, post.authorId),
    );
    return toComment(row, this.assets.base);
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
}
