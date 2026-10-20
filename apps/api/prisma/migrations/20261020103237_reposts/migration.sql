-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_type" ADD VALUE 'POST_REPOSTED';
ALTER TYPE "activity_type" ADD VALUE 'POST_QUOTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'POST_REPOSTED';
ALTER TYPE "notification_type" ADD VALUE 'POST_QUOTED';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "quoted_post_id" UUID,
ADD COLUMN     "repost_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "was_quote" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reposts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reposts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reposts_user_id_created_at_id_idx" ON "reposts"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "reposts_post_id_idx" ON "reposts"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "reposts_user_id_post_id_key" ON "reposts"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "posts_quoted_post_id_idx" ON "posts"("quoted_post_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_quoted_post_id_fkey" FOREIGN KEY ("quoted_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
