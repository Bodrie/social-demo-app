-- AlterEnum
ALTER TYPE "upload_kind" ADD VALUE 'message';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "image_key" TEXT;
