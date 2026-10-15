import type { PrismaClient } from '../../src/generated/prisma/client.js';

/** Every table, children first. Keep in sync with prisma/schema.prisma. */
export const TABLES = [
  'messages',
  'refresh_tokens',
  'activities',
  'follows',
  'comments',
  'post_likes',
  'posts',
  'users',
] as const;

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  );
}
