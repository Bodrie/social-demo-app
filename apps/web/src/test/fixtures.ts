import type { UserPrivate } from '@the-mesh/shared';

export const TEST_PASSWORD = 'Password123!';

export function makeUser(overrides: Partial<UserPrivate> = {}): UserPrivate {
  return {
    id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
    username: 'alice',
    name: 'Alice Anderson',
    avatarUrl: null,
    bio: null,
    city: 'Sofia',
    website: null,
    coverUrl: null,
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
    counts: { posts: 0, followers: 0, following: 0 },
    followedByMe: false,
    followsMe: false,
    email: 'alice@example.com',
    ...overrides,
  };
}
