/*
  Warnings:

  - You are about to drop the `TgVerification` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tgLinkedAt" TIMESTAMP(3),
ADD COLUMN     "tgUsername" TEXT;

-- DropTable
DROP TABLE "TgVerification";

-- CreateTable
CREATE TABLE "TgLinkCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TgLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TgLinkCode_codeHash_key" ON "TgLinkCode"("codeHash");

-- CreateIndex
CREATE INDEX "TgLinkCode_userId_idx" ON "TgLinkCode"("userId");

-- CreateIndex
CREATE INDEX "TgLinkCode_expiresAt_idx" ON "TgLinkCode"("expiresAt");

-- CreateIndex
CREATE INDEX "TgLinkCode_usedAt_idx" ON "TgLinkCode"("usedAt");

-- AddForeignKey
ALTER TABLE "TgLinkCode" ADD CONSTRAINT "TgLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
