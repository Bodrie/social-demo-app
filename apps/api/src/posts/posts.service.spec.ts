import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import { PostLikedEvent } from '../events/post.events.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UploadsService } from '../uploads/uploads.service.js';
import { PostsService } from './posts.service.js';

const config = { get: () => 'http://assets.local' } as unknown as ConfigService<Env, true>;

describe('PostsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let uploads: DeepMockProxy<UploadsService>;
  let events: DeepMockProxy<EventEmitter2>;
  let service: PostsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    uploads = mockDeep<UploadsService>();
    events = mockDeep<EventEmitter2>();
    service = new PostsService(prisma, uploads, events, config);
  });

  describe('delete', () => {
    it('refuses to delete somebody else’s post', async () => {
      prisma.post.findUnique.mockResolvedValue({ authorId: 'owner', imageKey: null } as never);

      await expect(service.delete('intruder', 'post-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.post.delete).not.toHaveBeenCalled();
    });

    it('deletes the own post and discards its image', async () => {
      prisma.post.findUnique.mockResolvedValue({ authorId: 'owner', imageKey: 'post/x.webp' } as never);
      prisma.post.delete.mockResolvedValue({} as never);

      await service.delete('owner', 'post-1');

      expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } });
      expect(uploads.discard).toHaveBeenCalledWith('post/x.webp');
    });

    it('404s on unknown posts', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.delete('owner', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('like', () => {
    it('emits an event only for a new like', async () => {
      prisma.post.findUnique.mockResolvedValue({ authorId: 'owner' } as never);
      prisma.postLike.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

      await service.like('fan', 'post-1');
      await service.like('fan', 'post-1');

      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith(PostLikedEvent.EVENT, new PostLikedEvent('post-1', 'fan', 'owner'));
    });
  });
});
