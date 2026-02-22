/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `HeroBanner` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `HeroBanner` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HeroBanner" DROP COLUMN "imageUrl",
DROP COLUMN "updatedAt",
ADD COLUMN     "imageDesktop" TEXT,
ADD COLUMN     "imageMobile" TEXT;
