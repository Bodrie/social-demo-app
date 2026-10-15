/**
 * Query key factory. Every key starts with its feature so invalidation can be scoped,
 * and `endSession` can drop everything except `me`. Post lists share the
 * `['posts', 'list']` prefix so cache updates (likes, deletes) reach every list.
 */
export const queryKeys = {
  me: ['me'] as const,
  users: {
    all: ['users'] as const,
    byUsername: (username: string) => ['users', 'by-username', username] as const,
    byId: (id: string) => ['users', id] as const,
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
