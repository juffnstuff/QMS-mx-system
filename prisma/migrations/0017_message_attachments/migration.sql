-- Email attachments extracted by the M365 scanner.

CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "processedMessageId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "extractedText" TEXT,
  "extractionError" TEXT,
  "excluded" BOOLEAN NOT NULL DEFAULT false,
  "userEditedText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_processedMessageId_fkey"
  FOREIGN KEY ("processedMessageId") REFERENCES "ProcessedMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MessageAttachment_processedMessageId_idx" ON "MessageAttachment"("processedMessageId");
