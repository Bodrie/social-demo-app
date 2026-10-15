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
    suggestions: ['users', 'list', 'suggestions'] as const,
  },
  posts: {
    lists: ['posts', 'list'] as const,
    feed: ['posts', 'list', 'feed'] as const,
    byUser: (userId: string) => ['posts', 'list', 'user', userId] as const,
  },
  comments: {
    all: ['comments'] as const,
    forPost: (postId: string) => ['comments', postId] as const,
  },
};
