-- AlterEnum
ALTER TYPE "email_token_kind" ADD VALUE 'change_email';

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pending_email" TEXT;
