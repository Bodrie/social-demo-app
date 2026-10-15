import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { Env } from '../config/env.js';
import { UserFollowedEvent } from '../events/user.events.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FollowsService } from './follows.service.js';

const config = { get: () => 'http://assets.local' } as unknown as ConfigService<Env, true>;

describe('FollowsService.follow', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let events: DeepMockProxy<EventEmitter2>;
  let service: FollowsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    events = mockDeep<EventEmitter2>();
    service = new FollowsService(prisma, events, config);
    prisma.user.count.mockResolvedValue(1);
  });

  it('rejects following yourself before touching the database', async () => {
    await expect(service.follow('me', 'me')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.follow.createMany).not.toHaveBeenCalled();
  });

  it('404s on unknown users', async () => {
    prisma.user.count.mockResolvedValue(0);
    await expect(service.follow('me', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('emits an event only when a new follow row was created', async () => {
    prisma.follow.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await service.follow('me', 'them');
    await service.follow('me', 'them');

    expect(events.emitAsync).toHaveBeenCalledTimes(1);
    expect(events.emitAsync).toHaveBeenCalledWith(UserFollowedEvent.EVENT, new UserFollowedEvent('me', 'them'));
  });
});
