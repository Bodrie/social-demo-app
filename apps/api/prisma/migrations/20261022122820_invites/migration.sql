-- Invites (F1): a member's personal invite code, and whose code a member registered with.

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'INVITE_JOINED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invite_code" TEXT,
ADD COLUMN     "invited_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "users_invite_code_key" ON "users"("invite_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "users_invited_by_id_idx" ON "users"("invited_by_id");
