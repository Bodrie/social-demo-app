import type { CommentSort } from '@the-mesh/shared';

/**
 * Query key factory. Every key starts with its feature so invalidation can be scoped,
 * and `endSession` can drop everything except `me`. Post and user lists share the
 * `[feature, 'list']` prefix so cache updates (likes, follows, deletes) reach every list.
 */
export const queryKeys = {
  me: ['me'] as const,
  users: {
    all: ['users'] as const,
    profiles: ['users', 'profile'] as const,
    profile: (username: string) => ['users', 'profile', username] as const,
    lists: ['users', 'list'] as const,
    followers: (userId: string) => ['users', 'list', 'followers', userId] as const,
    following: (userId: string) => ['users', 'list', 'following', userId] as const,
    search: (q: string) => ['users', 'list', 'search', q] as const,
    /** A flat `{ items }` list, deliberately outside `lists` (which hold infinite pages). */
    suggestions: ['users', 'suggestions'] as const,
    /** Flat search results behind the @mention autocomplete (also outside `lists`). */
    mentions: (q: string) => ['users', 'mentions', q] as const,
  },
  posts: {
    lists: ['posts', 'list'] as const,
    feed: ['posts', 'list', 'feed'] as const,
    byUser: (userId: string) => ['posts', 'list', 'user', userId] as const,
    byTag: (tag: string) => ['posts', 'list', 'tag', tag] as const,
    search: (q: string) => ['posts', 'list', 'search', q] as const,
    /** The viewer's saved posts, newest save first; under the lists prefix like every post list. */
    bookmarks: ['posts', 'list', 'bookmarks'] as const,
    /** One post as a one-item list, so every cache helper (likes, edits, deletes) reaches it. */
    detail: (postId: string) => ['posts', 'list', 'detail', postId] as const,
  },
  tags: {
    all: ['tags'] as const,
    trending: ['tags', 'trending'] as const,
  },
  comments: {
    all: ['comments'] as const,
    /** Prefix for every sort order of one post's comments. */
    ofPost: (postId: string) => ['comments', postId] as const,
    forPost: (postId: string, sort: CommentSort) => ['comments', postId, sort] as const,
    /** A comment fetched alone for a permalink that points past the loaded pages. */
    single: (commentId: string) => ['comments', 'single', commentId] as const,
  },
  revisions: {
    post: (postId: string) => ['revisions', 'post', postId] as const,
    comment: (commentId: string) => ['revisions', 'comment', commentId] as const,
  },
  activities: {
    all: ['activities'] as const,
    list: ['activities', 'list'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: ['notifications', 'list'] as const,
    /** `{ count }` of the unread ones: the bell, the nav badge and the tab title. */
    unread: ['notifications', 'unread'] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: ['conversations', 'list'] as const,
    details: ['conversations', 'detail'] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
    /** Prefix of every loaded thread. */
    threads: ['conversations', 'messages'] as const,
    messages: (id: string) => ['conversations', 'messages', id] as const,
  },
};
