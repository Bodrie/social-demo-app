import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreatePostData,
  CursorQuery,
  Paginated,
  Post,
  Revision,
  UpdatePostData,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { forbidden, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { toRevision } from '../common/revisions.js';
import { PostCreatedEvent, PostLikedEvent, PostUnlikedEvent } from '../events/post.events.js';
import type { Prisma } from '../generated/prisma/client.js';
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
    const row = await this.prisma.post.create({
      data: { authorId, content: input.content, imageKey: input.imageKey ?? null },
      select: postSelect(authorId),
    });
    await this.events.emitAsync(PostCreatedEvent.EVENT, new PostCreatedEvent(row.id, authorId));
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

  /** Author only. The previous text is kept as a revision; an unchanged text is a no-op. */
  async update(viewerId: string, postId: string, input: UpdatePostData): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, content: true },
    });
    if (!post) throw notFound('Post not found');
    if (post.authorId !== viewerId) throw forbidden('You can only edit your own posts');
    if (post.content !== input.content) {
      await this.prisma.$transaction([
        this.prisma.postRevision.create({ data: { postId, content: post.content } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { content: input.content, editedAt: new Date() },
        }),
      ]);
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
