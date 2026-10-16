import type {
  Activity,
  Comment,
  ConversationKind,
  Message,
  Post,
  ReactionSummary,
  ReactionType,
  Revision,
  UserPrivate,
  UserPublic,
} from '@the-mesh/shared';
import { alice, bob, carol, makePost, resetFixtureSequence, testId } from '../fixtures';

type Follow = { followerId: string; followingId: string };

/** A conversation as the "server" stores it; the viewer-specific shape is derived per request. */
export type MockConversation = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  createdById: string | null;
  createdAt: string;
  members: { userId: string; joinedAt: string; lastReadAt: string | null }[];
};
let conversationSequence = 0;

/** In-memory backend state for MSW handlers. Reset between tests by `resetMocks()`. */
export const mockDb = {
  /** The signed-in user (a reference into `users`), or null for no session. */
  user: null as UserPrivate | null,
  /** Whether POST /auth/refresh succeeds. */
  refreshable: false,
  users: [] as UserPrivate[],
  follows: [] as Follow[],
  posts: [] as Post[],
  comments: [] as Comment[],
  activities: [] as Activity[],
  conversations: [] as MockConversation[],
  messages: [] as Message[],
  reactions: [] as { commentId: string; userId: string; type: ReactionType }[],
  commentRevisions: new Map<string, Revision[]>(),
  postRevisions: new Map<string, Revision[]>(),
  uploads: 0,
  /** Links the fake API "mailed"; tests read the token here instead of an inbox. */
  emailTokens: [] as { token: string; kind: 'verify' | 'reset'; email: string }[],
  calls: { me: 0, refresh: 0, login: 0, logout: 0, passwordChanges: 0, forgot: 0 },
};

const clone = (user: UserPrivate): UserPrivate => ({ ...user, counts: { ...user.counts } });

export function resetMockDb(): void {
  mockDb.user = null;
  mockDb.refreshable = false;
  mockDb.users = [alice, bob, carol].map(clone);
  mockDb.follows = [];
  mockDb.posts = [];
  mockDb.comments = [];
  mockDb.activities = [];
  mockDb.conversations = [];
  conversationSequence = 0;
  mockDb.messages = [];
  mockDb.reactions = [];
  mockDb.commentRevisions = new Map();
  mockDb.postRevisions = new Map();
  mockDb.uploads = 0;
  mockDb.emailTokens = [];
  mockDb.calls = { me: 0, refresh: 0, login: 0, logout: 0, passwordChanges: 0, forgot: 0 };
  resetFixtureSequence();
}

resetMockDb();

/** Registers the user if needed and returns the stored copy (handlers mutate that one). */
export function upsertUser(user: UserPrivate): UserPrivate {
  const existing = mockDb.users.find((candidate) => candidate.id === user.id);
  if (existing) return existing;
  const stored = clone(user);
  mockDb.users.push(stored);
  return stored;
}

export function signedInAs(user: UserPrivate): UserPrivate {
  mockDb.user = upsertUser(user);
  return mockDb.user;
}

export function seedFollow(followerId: string, followingId: string): void {
  mockDb.follows.push({ followerId, followingId });
}

export function seedConversation(
  kind: ConversationKind,
  memberIds: string[],
  options: { title?: string; createdById?: string; createdAt?: string } = {},
): MockConversation {
  conversationSequence += 1;
  const createdAt = options.createdAt ?? '2026-10-15T08:00:00.000Z';
  const conversation: MockConversation = {
    id: testId('conversation', conversationSequence),
    kind,
    title: options.title ?? null,
    createdById: options.createdById ?? (kind === 'group' ? memberIds[0] : null) ?? null,
    createdAt,
    members: memberIds.map((userId) => ({ userId, joinedAt: createdAt, lastReadAt: null })),
  };
  mockDb.conversations.push(conversation);
  return conversation;
}

/** The direct thread between two people, created on first use (like the API). */
export function seedDirect(aId: string, bId: string): MockConversation {
  const pair = [aId, bId].toSorted().join(':');
  const existing = mockDb.conversations.find(
    (c) =>
      c.kind === 'direct' &&
      c.members
        .map((m) => m.userId)
        .toSorted()
        .join(':') === pair,
  );
  return existing ?? seedConversation('direct', [aId, bId]);
}

/** Moves a member's read mark (null clears it). */
export function seedReadMark(conversationId: string, userId: string, readAt: string | null): void {
  const member = mockDb.conversations
    .find((c) => c.id === conversationId)
    ?.members.find((m) => m.userId === userId);
  if (member) member.lastReadAt = readAt;
}

/** Seeds `count` posts, newest first, and returns them in that order. */
export function seedPosts(count: number, overrides: Partial<Post> = {}): Post[] {
  const posts = Array.from({ length: count }, () => makePost(overrides));
  mockDb.posts.push(...posts);
  return posts;
}

/** The public shape of a stored user as seen by `viewerId`, with live counts and flags. */
export function toPublic(user: UserPrivate, viewerId: string | null): UserPublic {
  const follows = mockDb.follows;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: user.city,
    website: user.website,
    coverUrl: user.coverUrl,
    createdAt: user.createdAt,
    counts: {
      posts: mockDb.posts.filter((post) => post.author.id === user.id).length,
      followers: follows.filter((follow) => follow.followingId === user.id).length,
      following: follows.filter((follow) => follow.followerId === user.id).length,
    },
    followedByMe: viewerId
      ? follows.some((follow) => follow.followerId === viewerId && follow.followingId === user.id)
      : false,
    followsMe: viewerId
      ? follows.some((follow) => follow.followerId === user.id && follow.followingId === viewerId)
      : false,
  };
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

/** Reaction summary of a comment as `viewerId` sees it, from the reactions table. */
export function reactionsFor(commentId: string, viewerId: string): ReactionSummary {
  const counts: Record<ReactionType, number> = { LIKE: 0, LOVE: 0, LAUGH: 0, WOW: 0, SAD: 0 };
  let total = 0;
  let mine: ReactionType | null = null;
  for (const reaction of mockDb.reactions) {
    if (reaction.commentId !== commentId) continue;
    counts[reaction.type] += 1;
    total += 1;
    if (reaction.userId === viewerId) mine = reaction.type;
  }
  return { counts, total, mine };
}
