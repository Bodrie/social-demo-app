-- Conversations become first-class: a direct conversation per pair of people and groups
-- with a title and any number of members. Read state moves from each message (`read_at`)
-- to the membership (`last_read_at`). Existing direct messages are carried over below;
-- the conversations created for them get v4 ids (Postgres 17 has no uuidv7()), which is
-- fine because conversations are ordered by `last_message_at`, never by id.

-- CreateEnum
CREATE TYPE "conversation_kind" AS ENUM ('direct', 'group');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "kind" "conversation_kind" NOT NULL,
    "title" TEXT,
    "created_by_id" UUID,
    "direct_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_created_at_idx" ON "conversations"("last_message_at", "created_at");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing direct messages over -------------------------------------------------

-- AlterTable (nullable for the backfill; made required below)
ALTER TABLE "messages" ADD COLUMN "conversation_id" UUID;

-- One direct conversation per pair; uuid ordering is bytewise, the same as the API's
-- string sort of the two ids.
INSERT INTO "conversations" ("id", "kind", "direct_key", "created_at", "last_message_at")
SELECT gen_random_uuid(), 'direct', pair.direct_key, pair.first_at, pair.last_at
FROM (
  SELECT
    LEAST(m.sender_id, m.recipient_id)::text || ':' || GREATEST(m.sender_id, m.recipient_id)::text AS direct_key,
    MIN(m.created_at) AS first_at,
    MAX(m.created_at) AS last_at
  FROM "messages" m
  GROUP BY 1
) pair;

UPDATE "messages" m
SET "conversation_id" = c."id"
FROM "conversations" c
WHERE c."direct_key" = LEAST(m.sender_id, m.recipient_id)::text || ':' || GREATEST(m.sender_id, m.recipient_id)::text;

-- Both people become members; what they had read (or written) sets their read mark.
INSERT INTO "conversation_members" ("conversation_id", "user_id", "joined_at", "last_read_at")
SELECT
  c."id",
  u.user_id,
  c."created_at",
  (
    SELECT MAX(m."created_at")
    FROM "messages" m
    WHERE m."conversation_id" = c."id"
      AND (m."sender_id" = u.user_id OR (m."recipient_id" = u.user_id AND m."read_at" IS NOT NULL))
  )
FROM "conversations" c
CROSS JOIN LATERAL (
  VALUES (split_part(c."direct_key", ':', 1)::uuid), (split_part(c."direct_key", ':', 2)::uuid)
) AS u(user_id)
WHERE c."kind" = 'direct';

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_recipient_id_fkey";

-- DropIndex
DROP INDEX "messages_recipient_id_read_at_idx";

-- DropIndex
DROP INDEX "messages_sender_id_recipient_id_created_at_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "read_at",
DROP COLUMN "recipient_id",
ALTER COLUMN "conversation_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_id_idx" ON "messages"("conversation_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
