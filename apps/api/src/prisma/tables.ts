/** Every application table, children first. The seed and the test harness truncate in this order. */
export const TABLES = [
  'messages',
  'refresh_tokens',
  'activities',
  'follows',
  'comments',
  'post_likes',
  'posts',
  'uploads',
  'users',
] as const;
