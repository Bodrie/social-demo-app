/** Every application table, children first. The seed and the test harness truncate in this order. */
export const TABLES = [
  'messages',
  'conversation_members',
  'conversations',
  'refresh_tokens',
  'email_tokens',
  'activities',
  'follows',
  'comment_reactions',
  'comment_revisions',
  'comments',
  'post_revisions',
  'post_likes',
  'posts',
  'uploads',
  'users',
] as const;
