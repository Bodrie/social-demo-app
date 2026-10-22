-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'ACHIEVEMENT_EARNED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "achievement_key" TEXT,
ALTER COLUMN "actor_id" DROP NOT NULL;

-- AlterTable: existing accounts stay null (their first count is a silent backfill), new ones
-- start counted.
ALTER TABLE "users" ADD COLUMN     "achievements_checked_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ALTER COLUMN "achievements_checked_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "user_achievements" (
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "earned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE INDEX "user_achievements_key_idx" ON "user_achievements"("key");

-- CreateIndex
CREATE INDEX "comment_reactions_user_id_idx" ON "comment_reactions"("user_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "post_hashtags_post_id_idx" ON "post_hashtags"("post_id");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

