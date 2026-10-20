-- AlterTable
-- Generated from the content so inserts and edits never have to maintain it (ADR 0014).
-- The config is `simple` (no stemming): the content is multilingual.
ALTER TABLE "posts" ADD COLUMN     "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;

-- CreateIndex
CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");
