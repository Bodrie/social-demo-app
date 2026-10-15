import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { ProfileUpdatedEvent, UserFollowedEvent, UserUnfollowedEvent } from '../events/user.events.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ActivitiesListener } from './activities.listener.js';

describe('ActivitiesListener', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let listener: ActivitiesListener;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    listener = new ActivitiesListener(prisma);
    prisma.activity.create.mockResolvedValue({} as never);
    prisma.activity.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('records profile updates only when a picture changed', async () => {
    await listener.onProfileUpdated(new ProfileUpdatedEvent('u1', ['name', 'bio']));
    expect(prisma.activity.create).not.toHaveBeenCalled();

    await listener.onProfileUpdated(new ProfileUpdatedEvent('u1', ['avatarKey']));
    expect(prisma.activity.create).toHaveBeenCalledWith({ data: { actorId: 'u1', type: 'PROFILE_UPDATED' } });
  });

  it('records follows and removes them again on unfollow', async () => {
    await listener.onUserFollowed(new UserFollowedEvent('me', 'them'));
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { actorId: 'me', type: 'USER_FOLLOWED', targetUserId: 'them' },
    });

    await listener.onUserUnfollowed(new UserUnfollowedEvent('me', 'them'));
    expect(prisma.activity.deleteMany).toHaveBeenCalledWith({
      where: { actorId: 'me', type: 'USER_FOLLOWED', targetUserId: 'them' },
    });
  });

  it('never throws when the database write fails', async () => {
    prisma.activity.create.mockRejectedValue(new Error('db down'));
    await expect(listener.onUserFollowed(new UserFollowedEvent('me', 'them'))).resolves.toBeUndefined();
  });
});
