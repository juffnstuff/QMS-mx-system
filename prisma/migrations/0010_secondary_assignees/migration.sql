-- Add secondary assignee fields for accountability

ALTER TABLE "Equipment" ADD COLUMN "secondaryTechnicianId" TEXT;
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "secondaryAssignedToId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "secondaryAssignedToId" TEXT;
ALTER TABLE "NonConformance" ADD COLUMN "secondaryInvestigatorId" TEXT;
ALTER TABLE "CAPA" ADD COLUMN "secondaryAssignedToId" TEXT;
ALTER TABLE "CustomerComplaint" ADD COLUMN "secondaryAssignedToId" TEXT;
ALTER TABLE "Project" ADD COLUMN "secondaryLeadId" TEXT;

-- Foreign keys
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_secondaryTechnicianId_fkey" FOREIGN KEY ("secondaryTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_secondaryAssignedToId_fkey" FOREIGN KEY ("secondaryAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_secondaryAssignedToId_fkey" FOREIGN KEY ("secondaryAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_secondaryInvestigatorId_fkey" FOREIGN KEY ("secondaryInvestigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_secondaryAssignedToId_fkey" FOREIGN KEY ("secondaryAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_secondaryAssignedToId_fkey" FOREIGN KEY ("secondaryAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_secondaryLeadId_fkey" FOREIGN KEY ("secondaryLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
