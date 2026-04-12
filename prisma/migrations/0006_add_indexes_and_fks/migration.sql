-- Add indexes for frequently filtered columns
CREATE INDEX IF NOT EXISTS "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE INDEX IF NOT EXISTS "WorkOrder_priority_idx" ON "WorkOrder"("priority");
CREATE INDEX IF NOT EXISTS "Equipment_status_idx" ON "Equipment"("status");
CREATE INDEX IF NOT EXISTS "AISuggestion_status_idx" ON "AISuggestion"("status");
CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_nextDue_idx" ON "MaintenanceSchedule"("nextDue");
CREATE INDEX IF NOT EXISTS "M365Connection_connectedBy_idx" ON "M365Connection"("connectedBy");
CREATE INDEX IF NOT EXISTS "ProcessedMessage_scannedByUserId_idx" ON "ProcessedMessage"("scannedByUserId");

-- Add foreign key constraint for ProcessedMessage.scannedByUserId
ALTER TABLE "ProcessedMessage" ADD CONSTRAINT "ProcessedMessage_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
