-- AlterTable: Add criticality, groupName, parentId to Equipment
ALTER TABLE "Equipment" ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'C';
ALTER TABLE "Equipment" ADD COLUMN "groupName" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Equipment_criticality_idx" ON "Equipment"("criticality");
CREATE INDEX "Equipment_groupName_idx" ON "Equipment"("groupName");
CREATE INDEX "Equipment_parentId_idx" ON "Equipment"("parentId");
