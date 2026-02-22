/*
  Warnings:

  - A unique constraint covering the columns `[tgChatId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "tgChatId" TEXT,
ADD COLUMN     "tgVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "TgVerification" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TgVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TgVerification_codeHash_key" ON "TgVerification"("codeHash");

-- CreateIndex
CREATE INDEX "TgVerification_chatId_idx" ON "TgVerification"("chatId");

-- CreateIndex
CREATE INDEX "TgVerification_expiresAt_idx" ON "TgVerification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_tgChatId_key" ON "User"("tgChatId");
