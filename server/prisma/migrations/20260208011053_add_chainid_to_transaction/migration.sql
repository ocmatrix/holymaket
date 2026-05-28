-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "chainId" INTEGER NOT NULL DEFAULT 11155111;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_chainId_status_idx" ON "Transaction"("chainId", "status");
