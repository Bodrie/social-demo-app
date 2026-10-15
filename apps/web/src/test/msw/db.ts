import type { Comment, Post, UserPrivate } from '@the-mesh/shared';
import { makePost, resetFixtureSequence } from '../fixtures';

/** In-memory backend state for MSW handlers. Reset between tests by `resetMocks()`. */
export const mockDb = {
  /** The signed-in user, or null for no session. */
  user: null as UserPrivate | null,
  /** Whether POST /auth/refresh succeeds. */
  refreshable: false,
  posts: [] as Post[],
  comments: [] as Comment[],
  uploads: 0,
  calls: { me: 0, refresh: 0, login: 0, logout: 0 },
};

export function resetMockDb(): void {
  mockDb.user = null;
  mockDb.refreshable = false;
  mockDb.posts = [];
  mockDb.comments = [];
  mockDb.uploads = 0;
  mockDb.calls = { me: 0, refresh: 0, login: 0, logout: 0 };
  resetFixtureSequence();
}

export function signedInAs(user: UserPrivate): UserPrivate {
  mockDb.user = user;
  return user;
}

/** Seeds `count` posts, newest first, and returns them in that order. */
export function seedPosts(count: number, overrides: Partial<Post> = {}): Post[] {
  const posts = Array.from({ length: count }, () => makePost(overrides));
  mockDb.posts.push(...posts);
  return posts;
}

/** Index-based cursor pagination over an already sorted list, mirroring `{ items, nextCursor }`. */
export function paginate<T extends { id: string }>(
  items: T[],
  url: URL,
): { items: T[]; nextCursor: string | null } {
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const cursor = url.searchParams.get('cursor');
  const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  const page = items.slice(start, start + limit);
  const last = page.at(-1);
  return { items: page, nextCursor: last && start + limit < items.length ? last.id : null };
}
