-- Add deltaLink and lastPolledAt to M365Connection for per-user delta tracking
ALTER TABLE "M365Connection" ADD COLUMN IF NOT EXISTS "deltaLink" TEXT;
ALTER TABLE "M365Connection" ADD COLUMN IF NOT EXISTS "lastPolledAt" TIMESTAMP(3);

-- Add scannedByUserId to ProcessedMessage
ALTER TABLE "ProcessedMessage" ADD COLUMN IF NOT EXISTS "scannedByUserId" TEXT;

-- Add sharePointDocId to AISuggestion (if not already added by 0003)
ALTER TABLE "AISuggestion" ADD COLUMN IF NOT EXISTS "sharePointDocId" TEXT;

-- Drop org-wide tables that are no longer needed
DROP TABLE IF EXISTS "M365UserMailbox";
DROP TABLE IF EXISTS "M365ScanConfig";
