import { Prisma } from '../generated/prisma/client.js';

/**
 * Makes the longest-standing member an admin when a group has none left (its last admin left,
 * was removed or deleted their account). Runs inside the caller's transaction; a no-op when an
 * admin remains.
 */
export const promoteIfNoAdminSql = (conversationId: string): Prisma.Sql => Prisma.sql`
  UPDATE conversation_members cm
  SET role = 'admin'
  WHERE cm.conversation_id = ${conversationId}::uuid
    AND NOT EXISTS (
      SELECT 1 FROM conversation_members a
      WHERE a.conversation_id = ${conversationId}::uuid AND a.role = 'admin'
    )
    AND cm.user_id = (
      SELECT o.user_id FROM conversation_members o
      WHERE o.conversation_id = ${conversationId}::uuid
      ORDER BY o.joined_at ASC, o.user_id ASC
      LIMIT 1
    )`;
