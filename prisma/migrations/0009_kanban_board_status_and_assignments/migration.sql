-- AlterTable: Add boardStatus to WorkOrder
ALTER TABLE "WorkOrder" ADD COLUMN "boardStatus" TEXT NOT NULL DEFAULT 'backlog';

-- AlterTable: Add boardStatus and assignedToId to MaintenanceSchedule
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "boardStatus" TEXT NOT NULL DEFAULT 'backlog';
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "assignedToId" TEXT;

-- AlterTable: Add boardStatus and assignedInvestigatorId to NonConformance
ALTER TABLE "NonConformance" ADD COLUMN "boardStatus" TEXT NOT NULL DEFAULT 'backlog';
ALTER TABLE "NonConformance" ADD COLUMN "assignedInvestigatorId" TEXT;

-- AlterTable: Add boardStatus to CAPA
ALTER TABLE "CAPA" ADD COLUMN "boardStatus" TEXT NOT NULL DEFAULT 'backlog';

-- AlterTable: Add assignedTechnicianId to Equipment
ALTER TABLE "Equipment" ADD COLUMN "assignedTechnicianId" TEXT;

-- AlterTable: Add assignedToId to CustomerComplaint
ALTER TABLE "CustomerComplaint" ADD COLUMN "assignedToId" TEXT;

-- AlterTable: Add boardStatus and projectLeadId to Project
ALTER TABLE "Project" ADD COLUMN "boardStatus" TEXT NOT NULL DEFAULT 'backlog';
ALTER TABLE "Project" ADD COLUMN "projectLeadId" TEXT;

-- CreateIndex
CREATE INDEX "WorkOrder_boardStatus_idx" ON "WorkOrder"("boardStatus");
CREATE INDEX "MaintenanceSchedule_boardStatus_idx" ON "MaintenanceSchedule"("boardStatus");
CREATE INDEX "MaintenanceSchedule_assignedToId_idx" ON "MaintenanceSchedule"("assignedToId");
CREATE INDEX "NonConformance_boardStatus_idx" ON "NonConformance"("boardStatus");
CREATE INDEX "NonConformance_assignedInvestigatorId_idx" ON "NonConformance"("assignedInvestigatorId");
CREATE INDEX "CAPA_boardStatus_idx" ON "CAPA"("boardStatus");
CREATE INDEX "Equipment_assignedTechnicianId_idx" ON "Equipment"("assignedTechnicianId");
CREATE INDEX "CustomerComplaint_assignedToId_idx" ON "CustomerComplaint"("assignedToId");
CREATE INDEX "Project_boardStatus_idx" ON "Project"("boardStatus");
CREATE INDEX "Project_projectLeadId_idx" ON "Project"("projectLeadId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_assignedInvestigatorId_fkey" FOREIGN KEY ("assignedInvestigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectLeadId_fkey" FOREIGN KEY ("projectLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill boardStatus from existing status values
-- WorkOrder: open→backlog, in_progress→in_progress, completed→done, cancelled→done
UPDATE "WorkOrder" SET "boardStatus" = CASE
  WHEN "status" = 'open' THEN 'backlog'
  WHEN "status" = 'in_progress' THEN 'in_progress'
  WHEN "status" = 'completed' THEN 'done'
  WHEN "status" = 'cancelled' THEN 'done'
  ELSE 'backlog'
END;

-- NonConformance: open→backlog, under_review→in_progress, dispositioned→scheduled, closed→done
UPDATE "NonConformance" SET "boardStatus" = CASE
  WHEN "status" = 'open' THEN 'backlog'
  WHEN "status" = 'under_review' THEN 'in_progress'
  WHEN "status" = 'dispositioned' THEN 'scheduled'
  WHEN "status" = 'closed' THEN 'done'
  ELSE 'backlog'
END;

-- CAPA: open→backlog, in_progress→in_progress, pending_verification→scheduled, closed→done
UPDATE "CAPA" SET "boardStatus" = CASE
  WHEN "status" = 'open' THEN 'backlog'
  WHEN "status" = 'in_progress' THEN 'in_progress'
  WHEN "status" = 'pending_verification' THEN 'scheduled'
  WHEN "status" = 'closed' THEN 'done'
  ELSE 'backlog'
END;

-- Project: planning→backlog, in_progress→in_progress, on_hold→needs_parts, completed→done
UPDATE "Project" SET "boardStatus" = CASE
  WHEN "status" = 'planning' THEN 'backlog'
  WHEN "status" = 'in_progress' THEN 'in_progress'
  WHEN "status" = 'on_hold' THEN 'needs_parts'
  WHEN "status" = 'completed' THEN 'done'
  ELSE 'backlog'
END;

-- MaintenanceSchedule: overdue→backlog, upcoming (within 7 days)→scheduled, else→backlog
UPDATE "MaintenanceSchedule" SET "boardStatus" = CASE
  WHEN "nextDue" < NOW() THEN 'backlog'
  WHEN "nextDue" <= NOW() + INTERVAL '7 days' THEN 'scheduled'
  ELSE 'scheduled'
END;
