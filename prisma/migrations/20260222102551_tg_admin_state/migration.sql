-- CreateTable
CREATE TABLE "TgAdminState" (
    "chatId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'IDLE',
    "draftText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TgAdminState_pkey" PRIMARY KEY ("chatId")
);
