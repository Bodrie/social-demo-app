/** Query key factory: every key starts with its feature so invalidation can be scoped. */
export const queryKeys = {
  me: ['me'] as const,
  users: {
    all: ['users'] as const,
    byUsername: (username: string) => ['users', 'by-username', username] as const,
    byId: (id: string) => ['users', id] as const,
  },
};
