-- CreateEnum
CREATE TYPE "upload_kind" AS ENUM ('avatar', 'cover', 'post');

-- DropIndex
DROP INDEX "comments_post_id_created_at_idx";

-- DropIndex
DROP INDEX "follows_followee_id_idx";

-- DropIndex
DROP INDEX "posts_author_id_created_at_idx";

-- CreateTable
CREATE TABLE "uploads" (
    "key" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "upload_kind" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "uploads_owner_id_idx" ON "uploads"("owner_id");

-- CreateIndex
CREATE INDEX "uploads_created_at_idx" ON "uploads"("created_at");

-- CreateIndex
CREATE INDEX "activities_created_at_id_idx" ON "activities"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_id_idx" ON "comments"("post_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "follows_followee_id_created_at_follower_id_idx" ON "follows"("followee_id", "created_at" DESC, "follower_id" DESC);

-- CreateIndex
CREATE INDEX "follows_follower_id_created_at_followee_id_idx" ON "follows"("follower_id", "created_at" DESC, "followee_id" DESC);

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_id_idx" ON "posts"("author_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma has no schema syntax for CHECK constraints.
-- A user cannot message themselves (also enforced in the service layer).
ALTER TABLE "messages" ADD CONSTRAINT "messages_no_self_message" CHECK ("sender_id" <> "recipient_id");
