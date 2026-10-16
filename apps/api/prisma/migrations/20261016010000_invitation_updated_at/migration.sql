-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Invitation_accountId_phone_idx" ON "Invitation"("accountId", "phone");
