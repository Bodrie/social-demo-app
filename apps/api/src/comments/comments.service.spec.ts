import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CommentsService } from './comments.service.js';

const config = { get: () => 'http://assets.local' } as unknown as ConfigService<Env, true>;
const stored = { authorId: 'commenter', post: { authorId: 'poster' } };

describe('CommentsService.delete', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: CommentsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new CommentsService(prisma, mockDeep<EventEmitter2>(), config);
    prisma.comment.findUnique.mockResolvedValue(stored as never);
    prisma.comment.delete.mockResolvedValue({} as never);
  });

  it('allows the comment author', async () => {
    await service.delete('commenter', 'c1');
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('allows the post author', async () => {
    await service.delete('poster', 'c1');
    expect(prisma.comment.delete).toHaveBeenCalledTimes(1);
  });

  it('refuses anyone else', async () => {
    await expect(service.delete('stranger', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it('404s on unknown comments', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(service.delete('commenter', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
