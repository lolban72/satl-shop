-- CreateTable
CREATE TABLE "MarqueeSettings" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT 'СКИДКИ 20%',
    "speedSeconds" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarqueeSettings_pkey" PRIMARY KEY ("id")
);
