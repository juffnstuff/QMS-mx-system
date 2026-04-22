-- Persist the full email body so "Create from email" can prefill record
-- descriptions with more than the 500-char preview.

ALTER TABLE "ProcessedMessage"
  ADD COLUMN "bodyContent" TEXT;
