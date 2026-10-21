-- D2 richer posts: the size of every stored file, up to four pictures per post, and chat
-- pictures read their size through their upload row.

-- AlterTable: filled at upload time from now on; older files by the daily job
-- (`UploadsService.fillSizes`), which reads them from storage.
ALTER TABLE "uploads" ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- CreateTable
CREATE TABLE "post_images" (
    "post_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("post_id","position")
);

-- CreateIndex
CREATE INDEX "post_images_key_idx" ON "post_images"("key");

-- CreateIndex
CREATE INDEX "messages_image_key_idx" ON "messages"("image_key");

-- Every attached key has an upload row already (only owned uploads can be attached); this makes
-- sure of it before the foreign keys arrive, so a stray row can never stop the deploy.
INSERT INTO "uploads" ("key", "owner_id", "kind", "created_at")
SELECT DISTINCT ON ("image_key") "image_key", "author_id", 'post', "created_at"
FROM "posts" WHERE "image_key" IS NOT NULL
ORDER BY "image_key", "created_at"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "uploads" ("key", "owner_id", "kind", "created_at")
SELECT DISTINCT ON ("image_key") "image_key", "sender_id", 'message', "created_at"
FROM "messages" WHERE "image_key" IS NOT NULL
ORDER BY "image_key", "created_at"
ON CONFLICT ("key") DO NOTHING;

-- The single picture of a post becomes its first.
INSERT INTO "post_images" ("post_id", "position", "key")
SELECT "id", 0, "image_key" FROM "posts" WHERE "image_key" IS NOT NULL;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "image_key";

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_key_fkey" FOREIGN KEY ("key") REFERENCES "uploads"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_image_key_fkey" FOREIGN KEY ("image_key") REFERENCES "uploads"("key") ON DELETE SET NULL ON UPDATE CASCADE;
