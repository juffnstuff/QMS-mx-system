-- Audit log of status / boardStatus changes on work orders, NCRs, CAPAs,
-- projects, and maintenance schedules.

CREATE TABLE "StatusChangeLog" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT NOT NULL,
  "note" TEXT,
  "changedById" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StatusChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusChangeLog_entityType_entityId_changedAt_idx"
  ON "StatusChangeLog"("entityType", "entityId", "changedAt");
CREATE INDEX "StatusChangeLog_changedById_idx"
  ON "StatusChangeLog"("changedById");

ALTER TABLE "StatusChangeLog"
  ADD CONSTRAINT "StatusChangeLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
