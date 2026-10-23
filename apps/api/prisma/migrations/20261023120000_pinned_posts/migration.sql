-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pinned_post_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "users_pinned_post_id_key" ON "users"("pinned_post_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pinned_post_id_fkey" FOREIGN KEY ("pinned_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

