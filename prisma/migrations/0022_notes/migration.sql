-- Freeform operator notes on any record.

CREATE TABLE "Note" (
  "id" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Note_recordType_recordId_createdAt_idx"
  ON "Note"("recordType", "recordId", "createdAt");
CREATE INDEX "Note_createdById_idx"
  ON "Note"("createdById");

ALTER TABLE "Note"
  ADD CONSTRAINT "Note_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
