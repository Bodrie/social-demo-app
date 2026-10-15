import type { Comment, Post, UserPrivate, UserSummary } from '@the-mesh/shared';

export const TEST_PASSWORD = 'Password123!';

const BASE_TIME = Date.UTC(2026, 9, 15, 10, 0, 0);
let sequence = 0;

/** Deterministic, valid (v7-shaped) UUIDs so failures are readable. */
export function testId(kind: 'user' | 'post' | 'comment', n: number): string {
  const prefix = { user: '01a13e00', post: '01a13f00', comment: '01a14000' }[kind];
  return `${prefix}-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

export function makeUser(overrides: Partial<UserPrivate> = {}): UserPrivate {
  return {
    id: testId('user', 1),
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

export const alice = makeUser();
export const bob = makeUser({
  id: testId('user', 2),
  username: 'bob',
  name: 'Bob Brown',
  email: 'bob@example.com',
});

export function summaryOf(user: UserPrivate): UserSummary {
  return { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl };
}

/** Each call is one minute older than the previous one, so lists sort newest-first. */
export function makePost(overrides: Partial<Post> = {}): Post {
  sequence += 1;
  const createdAt = new Date(BASE_TIME - sequence * 60_000).toISOString();
  return {
    id: testId('post', sequence),
    content: `Post number ${sequence}`,
    imageUrl: null,
    author: summaryOf(bob),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export function makeComment(postId: string, overrides: Partial<Comment> = {}): Comment {
  sequence += 1;
  const createdAt = new Date(BASE_TIME - sequence * 60_000).toISOString();
  return {
    id: testId('comment', sequence),
    postId,
    content: `Comment number ${sequence}`,
    author: summaryOf(bob),
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export function resetFixtureSequence(): void {
  sequence = 0;
}
