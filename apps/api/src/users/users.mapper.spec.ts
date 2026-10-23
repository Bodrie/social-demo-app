import { userPrivateSchema, userPublicSchema } from '@beso/shared';
import { type UserPrivateRow, toUserPrivate, toUserPublic } from './users.mapper.js';

const row: UserPrivateRow = {
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
  username: 'alice',
  name: 'Alice',
  bio: null,
  city: 'Sofia',
  website: null,
  avatarKey: 'avatars/alice.webp',
  coverKey: null,
  avatarPreset: null,
  coverPreset: null,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T11:00:00.000Z'),
  email: 'alice@example.com',
  settings: { chatBubbles: false, unknownKey: 1 },
  emailVerifiedAt: new Date('2026-10-15T10:05:00.000Z'),
  pendingEmail: null,
  role: 'member',
  suspendedAt: null,
  pinnedPostId: null,
  ring: null,
  featuredBadges: [],
  _count: { posts: 3, followers: 2, following: 1 },
  followers: [{ followerId: 'viewer' }],
  following: [],
};

describe('users mapper', () => {
  it('builds asset URLs, ISO dates and counts for the public shape', () => {
    const user = toUserPublic(row, 'http://assets.local/files');

    expect(userPublicSchema.parse(user)).toEqual(user);
    expect(user.avatarUrl).toBe('http://assets.local/files/avatars/alice.webp');
    expect(user.coverUrl).toBeNull();
    expect(user.createdAt).toBe('2026-10-15T10:00:00.000Z');
    expect(user.counts).toEqual({ posts: 3, followers: 2, following: 1 });
    expect(user).toMatchObject({ followedByMe: true, followsMe: false });
    expect(user).not.toHaveProperty('email');
  });

  it('adds email and updatedAt for the private shape', () => {
    const me = toUserPrivate(row, 'http://assets.local');

    expect(userPrivateSchema.parse(me)).toEqual(me);
    expect(me.email).toBe('alice@example.com');
    expect(me.updatedAt).toBe('2026-10-15T11:00:00.000Z');
  });
});

describe('toUserSettings', () => {
  it('applies the defaults, keeps what is stored and drops what it does not know', async () => {
    const { toUserSettings } = await import('./users.mapper.js');
    expect(toUserSettings({ chatBubbles: false, unknownKey: 1 })).toEqual({
      chatBubbles: false,
      messageSound: false,
      browserNotifications: false,
      pushMessages: true,
      pushSocial: true,
      pushPreviews: true,
      showAchievements: true,
      showRing: true,
      hideGettingStarted: false,
      timeZone: null,
    });
    expect(toUserSettings(null)).toEqual({
      chatBubbles: true,
      messageSound: false,
      browserNotifications: false,
      pushMessages: true,
      pushSocial: true,
      pushPreviews: true,
      showAchievements: true,
      showRing: true,
      hideGettingStarted: false,
      timeZone: null,
    });
    expect(toUserSettings('garbage').chatBubbles).toBe(true);
    // A zone Intl no longer knows reads as none and spoils nothing else.
    expect(toUserSettings({ timeZone: 'Atlantis/Capital', chatBubbles: false })).toMatchObject({
      timeZone: null,
      chatBubbles: false,
    });
    expect(toUserSettings({ timeZone: 'Europe/Sofia' }).timeZone).toBe('Europe/Sofia');
  });
});
