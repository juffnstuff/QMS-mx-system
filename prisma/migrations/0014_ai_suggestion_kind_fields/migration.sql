-- Add AI-classified "kind" and per-kind proposedFields JSON to AISuggestion.
-- Kind is stored as a plain TEXT to stay consistent with the rest of the schema
-- (status, suggestionType, etc. are all string-enumerated TEXT columns).
-- Allowed values: 'maintenance' | 'project' | 'equipment' | 'child_component'

ALTER TABLE "AISuggestion" ADD COLUMN "kind" TEXT;
ALTER TABLE "AISuggestion" ADD COLUMN "proposedFields" JSONB;

-- Backfill existing rows based on their existing suggestionType so the UI can
-- render the new per-kind editor without losing historical data.
UPDATE "AISuggestion"
SET "kind" = CASE
    WHEN "suggestionType" = 'create_project' THEN 'project'
    WHEN "suggestionType" = 'create_maintenance_log' THEN 'maintenance'
    WHEN "suggestionType" = 'create_auxiliary_equipment' THEN 'child_component'
    WHEN "suggestionType" IN ('create_work_order', 'update_equipment_status') THEN 'equipment'
    ELSE 'project'
END
WHERE "kind" IS NULL;

-- Enforce NOT NULL now that every row is populated.
ALTER TABLE "AISuggestion" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "AISuggestion" ALTER COLUMN "kind" SET DEFAULT 'project';

-- Constrain to the allowed set.
ALTER TABLE "AISuggestion"
  ADD CONSTRAINT "AISuggestion_kind_check"
  CHECK ("kind" IN ('maintenance', 'project', 'equipment', 'child_component'));

CREATE INDEX "AISuggestion_kind_idx" ON "AISuggestion"("kind");
