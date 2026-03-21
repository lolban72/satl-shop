-- AlterTable
ALTER TABLE "PaymentDraft" ADD COLUMN     "deliveryTax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "promoCodeId" TEXT;

-- CreateIndex
CREATE INDEX "PaymentDraft_promoCodeId_idx" ON "PaymentDraft"("promoCodeId");

-- AddForeignKey
ALTER TABLE "PaymentDraft" ADD CONSTRAINT "PaymentDraft_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
