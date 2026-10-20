-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('member', 'admin');

-- CreateEnum
CREATE TYPE "admin_action_type" AS ENUM ('report_resolved', 'report_dismissed', 'post_deleted', 'comment_deleted', 'user_suspended', 'user_unsuspended');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'member',
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" UUID NOT NULL,
    "admin_id" UUID,
    "action" "admin_action_type" NOT NULL,
    "target_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_actions_created_at_id_idx" ON "admin_actions"("created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
