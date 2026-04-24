-- Traceability: link MaintenanceLog + WorkOrder back to the PM checklist
-- completion (and item) that created them. All nullable; no data migration.

ALTER TABLE "MaintenanceLog"
  ADD COLUMN "sourceChecklistCompletionId" TEXT;

CREATE INDEX "MaintenanceLog_sourceChecklistCompletionId_idx"
  ON "MaintenanceLog"("sourceChecklistCompletionId");

ALTER TABLE "MaintenanceLog"
  ADD CONSTRAINT "MaintenanceLog_sourceChecklistCompletionId_fkey"
  FOREIGN KEY ("sourceChecklistCompletionId") REFERENCES "ChecklistCompletion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD COLUMN "sourceChecklistCompletionId" TEXT,
  ADD COLUMN "sourceChecklistItemId"       TEXT;

CREATE INDEX "WorkOrder_sourceChecklistCompletionId_idx"
  ON "WorkOrder"("sourceChecklistCompletionId");
CREATE INDEX "WorkOrder_sourceChecklistItemId_idx"
  ON "WorkOrder"("sourceChecklistItemId");

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_sourceChecklistCompletionId_fkey"
  FOREIGN KEY ("sourceChecklistCompletionId") REFERENCES "ChecklistCompletion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_sourceChecklistItemId_fkey"
  FOREIGN KEY ("sourceChecklistItemId") REFERENCES "ChecklistItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
