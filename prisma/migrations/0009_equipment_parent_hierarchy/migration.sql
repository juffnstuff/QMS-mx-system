-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "parentEquipmentId" TEXT;

-- CreateIndex
CREATE INDEX "Equipment_parentEquipmentId_idx" ON "Equipment"("parentEquipmentId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_parentEquipmentId_fkey" FOREIGN KEY ("parentEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
