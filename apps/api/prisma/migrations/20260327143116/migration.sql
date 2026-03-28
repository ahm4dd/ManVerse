-- RenameForeignKey
ALTER TABLE "account" RENAME CONSTRAINT "account_userId_fkey" TO "account_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "session" RENAME CONSTRAINT "session_userId_fkey" TO "session_user_id_fkey";

-- RenameIndex
ALTER INDEX "account_userId_idx" RENAME TO "account_user_id_idx";

-- RenameIndex
ALTER INDEX "session_userId_idx" RENAME TO "session_user_id_idx";
