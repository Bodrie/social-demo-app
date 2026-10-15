import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CreatePostData, CursorQuery, Paginated, Post } from '@the-mesh/shared';
import { decodeCursor, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { PostCreatedEvent, PostLikedEvent } from '../events/post.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { postSelect, toPost } from './posts.mapper.js';

@Injectable()
export class PostsService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  async create(authorId: string, input: CreatePostData): Promise<Post> {
    if (input.imageKey) await this.uploads.assertExists(input.imageKey, 'imageKey');
    const row = await this.prisma.post.create({
      data: { authorId, content: input.content, imageKey: input.imageKey ?? null },
      select: postSelect(authorId),
    });
    this.events.emit(PostCreatedEvent.EVENT, new PostCreatedEvent(row.id, authorId));
    return toPost(row, this.assetsBase);
  }

  async getById(viewerId: string, postId: string): Promise<Post> {
    const row = await this.prisma.post.findUnique({ where: { id: postId }, select: postSelect(viewerId) });
    if (!row) throw this.notFound();
    return toPost(row, this.assetsBase);
  }

  /** The viewer's own posts plus those of everyone they follow, newest first. */
  feed(viewerId: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.list(viewerId, query, {
      OR: [{ authorId: viewerId }, { author: { followers: { some: { followerId: viewerId } } } }],
    });
  }

  byAuthor(viewerId: string, authorId: string, query: CursorQuery): Promise<Paginated<Post>> {
    return this.list(viewerId, query, { authorId });
  }

  async delete(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, imageKey: true },
    });
    if (!post) throw this.notFound();
    if (post.authorId !== viewerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only delete your own posts' });
    }
    await this.prisma.post.delete({ where: { id: postId } });
    await this.uploads.discard(post.imageKey);
  }

  /** Idempotent: liking twice is a no-op and only the first like emits an event. */
  async like(viewerId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) throw this.notFound();
    const result = await this.prisma.postLike.createMany({
      data: { userId: viewerId, postId },
      skipDuplicates: true,
    });
    if (result.count === 1) {
      this.events.emit(PostLikedEvent.EVENT, new PostLikedEvent(postId, viewerId, post.authorId));
    }
  }

  async unlike(viewerId: string, postId: string): Promise<void> {
    const exists = await this.prisma.post.count({ where: { id: postId } });
    if (exists === 0) throw this.notFound();
    await this.prisma.postLike.deleteMany({ where: { userId: viewerId, postId } });
  }

  private async list(
    viewerId: string,
    query: CursorQuery,
    where: Prisma.PostWhereInput,
  ): Promise<Paginated<Post>> {
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.post.findMany({
      where,
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    return paginate(rows, query.limit, (row) => toPost(row, this.assetsBase));
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'Post not found' });
  }
}
