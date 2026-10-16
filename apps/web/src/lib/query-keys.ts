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
  },
  posts: {
    lists: ['posts', 'list'] as const,
    feed: ['posts', 'list', 'feed'] as const,
    byUser: (userId: string) => ['posts', 'list', 'user', userId] as const,
  },
  comments: {
    all: ['comments'] as const,
    /** Prefix for every sort order of one post's comments. */
    ofPost: (postId: string) => ['comments', postId] as const,
    forPost: (postId: string, sort: CommentSort) => ['comments', postId, sort] as const,
  },
  revisions: {
    post: (postId: string) => ['revisions', 'post', postId] as const,
    comment: (commentId: string) => ['revisions', 'comment', commentId] as const,
  },
  activities: {
    all: ['activities'] as const,
    list: ['activities', 'list'] as const,
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
