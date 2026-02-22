/*
  Warnings:

  - You are about to drop the column `order` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "order",
ADD COLUMN     "homeOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "navOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT true;
