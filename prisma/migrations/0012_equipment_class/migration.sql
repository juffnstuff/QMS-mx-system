-- Add equipmentClass field for categorizing equipment

ALTER TABLE "Equipment" ADD COLUMN "equipmentClass" TEXT;

CREATE INDEX "Equipment_equipmentClass_idx" ON "Equipment"("equipmentClass");
