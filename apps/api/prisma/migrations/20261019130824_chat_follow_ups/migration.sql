-- CreateEnum
CREATE TYPE "conversation_role" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "message_kind" AS ENUM ('user', 'system');

-- AlterTable
ALTER TABLE "conversation_members" ADD COLUMN     "role" "conversation_role" NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "kind" "message_kind" NOT NULL DEFAULT 'user',
ADD COLUMN     "system_meta" JSONB;

-- Backfill roles: the creator of a group is its admin; a group whose creator is gone gets its
-- longest-standing member instead, so every group has at least one admin.
UPDATE "conversation_members" cm
SET "role" = 'admin'
FROM "conversations" c
WHERE c.id = cm.conversation_id AND c.kind = 'group' AND c.created_by_id = cm.user_id;

UPDATE "conversation_members" cm
SET "role" = 'admin'
FROM "conversations" c
WHERE c.id = cm.conversation_id
  AND c.kind = 'group'
  AND NOT EXISTS (
    SELECT 1 FROM "conversation_members" a WHERE a.conversation_id = c.id AND a.role = 'admin'
  )
  AND cm.user_id = (
    SELECT o.user_id FROM "conversation_members" o
    WHERE o.conversation_id = c.id
    ORDER BY o.joined_at ASC, o.user_id ASC
    LIMIT 1
  );
