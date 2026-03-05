-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cdekStatus" TEXT,
ADD COLUMN     "cdekStatusAt" TIMESTAMP(3),
ADD COLUMN     "cdekUuid" TEXT,
ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "deliveryPrice" INTEGER,
ADD COLUMN     "pvzAddress" TEXT,
ADD COLUMN     "pvzCode" TEXT;

-- AlterTable
ALTER TABLE "PaymentDraft" ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "deliveryPrice" INTEGER,
ADD COLUMN     "pvzAddress" TEXT,
ADD COLUMN     "pvzCode" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "weightGr" INTEGER,
ADD COLUMN     "widthCm" INTEGER;
