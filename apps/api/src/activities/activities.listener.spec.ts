import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { AssetsService } from '../assets/assets.service.js';
import { ActivityRecordedEvent } from '../events/activity.events.js';
import { PostLikedEvent } from '../events/post.events.js';
import {
  ProfileUpdatedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
} from '../events/user.events.js';
import type { VisibilityService } from '../moderation/visibility.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ACTIVITY_PUSH_AUDIENCE, ActivitiesListener } from './activities.listener.js';
import { type ActivityRow, activitySelect } from './activities.mapper.js';

const person = (id: string) => ({
  id,
  username: id,
  name: id,
  avatarKey: null,
  avatarPreset: null,
  ring: null,
});

function rowFor(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
    type: 'POST_LIKED',
    createdAt: new Date('2026-10-22T10:00:00.000Z'),
    actor: person('bob'),
    post: { id: 'post-1', content: 'carol wrote this', authorId: 'carol' },
    comment: null,
    targetUser: null,
    ...overrides,
  };
}

describe('ActivitiesListener', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let visibility: DeepMockProxy<VisibilityService>;
  let events: DeepMockProxy<EventEmitter2>;
  let listener: ActivitiesListener;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    visibility = mockDeep<VisibilityService>();
    events = mockDeep<EventEmitter2>();
    const assets = { base: 'http://assets.local' } as AssetsService;
    listener = new ActivitiesListener(prisma, assets, visibility, events);
    prisma.activity.create.mockResolvedValue(rowFor() as never);
    prisma.activity.deleteMany.mockResolvedValue({ count: 1 });
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('records profile updates only when a picture changed', async () => {
    await listener.onProfileUpdated(new ProfileUpdatedEvent('u1', ['name', 'bio']));
    expect(prisma.activity.create).not.toHaveBeenCalled();

    await listener.onProfileUpdated(new ProfileUpdatedEvent('u1', ['avatarKey']));
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { actorId: 'u1', type: 'PROFILE_UPDATED' },
      select: activitySelect,
    });
  });

  it('records follows and removes them again on unfollow', async () => {
    await listener.onUserFollowed(new UserFollowedEvent('me', 'them'));
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { actorId: 'me', type: 'USER_FOLLOWED', targetUserId: 'them' },
      select: activitySelect,
    });

    await listener.onUserUnfollowed(new UserUnfollowedEvent('me', 'them'));
    expect(prisma.activity.deleteMany).toHaveBeenCalledWith({
      where: { actorId: 'me', type: 'USER_FOLLOWED', targetUserId: 'them' },
    });
    // Undoing something pushes nothing: the row is simply gone at the next fetch.
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('pushes a new row to the followers who may see the actor, the target and the post author', async () => {
    prisma.follow.findMany.mockResolvedValue([
      { followerId: 'alice' },
      { followerId: 'dave' },
    ] as never);
    visibility.viewersOf.mockResolvedValue(['alice']);

    await listener.onPostLiked(new PostLikedEvent('post-1', 'bob', 'carol'));

    expect(prisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followeeId: 'bob' }, take: ACTIVITY_PUSH_AUDIENCE }),
    );
    expect(visibility.viewersOf).toHaveBeenCalledWith(['alice', 'dave'], ['bob', 'carol']);
    const [name, event] = events.emitAsync.mock.calls[0] ?? [];
    expect(name).toBe(ActivityRecordedEvent.EVENT);
    expect(event).toBeInstanceOf(ActivityRecordedEvent);
    expect(event).toMatchObject({
      recipientIds: ['alice'],
      activity: { type: 'POST_LIKED', actor: { id: 'bob' }, post: { id: 'post-1' } },
    });
  });

  it('pushes nothing when nobody follows the actor or nobody may see it', async () => {
    await listener.onPostLiked(new PostLikedEvent('post-1', 'bob', 'carol'));
    expect(visibility.viewersOf).not.toHaveBeenCalled();

    prisma.follow.findMany.mockResolvedValue([{ followerId: 'dave' }] as never);
    visibility.viewersOf.mockResolvedValue([]);
    await listener.onPostLiked(new PostLikedEvent('post-1', 'bob', 'carol'));
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('never throws when the database write or the push fails', async () => {
    prisma.activity.create.mockRejectedValue(new Error('db down'));
    await expect(
      listener.onUserFollowed(new UserFollowedEvent('me', 'them')),
    ).resolves.toBeUndefined();

    prisma.activity.create.mockResolvedValue(rowFor() as never);
    prisma.follow.findMany.mockRejectedValue(new Error('db down'));
    await expect(
      listener.onPostLiked(new PostLikedEvent('post-1', 'bob', 'carol')),
    ).resolves.toBeUndefined();
  });
});
