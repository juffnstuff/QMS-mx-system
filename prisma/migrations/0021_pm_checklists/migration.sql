-- PM checklist templates, items, completions, and per-item results.
-- Drives the F-19 Daily / Weekly / Monthly PM forms per QMS P-19.

-- Link from schedule to the template that spawns completions.
ALTER TABLE "MaintenanceSchedule"
  ADD COLUMN "checklistTemplateId" TEXT;

CREATE INDEX "MaintenanceSchedule_checklistTemplateId_idx"
  ON "MaintenanceSchedule"("checklistTemplateId");

-- Template: reusable PM checklist blueprint.
CREATE TABLE "ChecklistTemplate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "description" TEXT,
  "supersedesCodes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistTemplate_code_key" ON "ChecklistTemplate"("code");
CREATE INDEX "ChecklistTemplate_frequency_idx" ON "ChecklistTemplate"("frequency");
CREATE INDEX "ChecklistTemplate_scope_idx" ON "ChecklistTemplate"("scope");

-- Item: individual check line in a template.
CREATE TABLE "ChecklistItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "section" TEXT,
  "label" TEXT NOT NULL,
  "details" TEXT,
  "inputType" TEXT NOT NULL DEFAULT 'checkbox',
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "escalationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistItem_templateId_sortOrder_idx"
  ON "ChecklistItem"("templateId", "sortOrder");

-- Completion: one scheduled run of a template against an equipment.
CREATE TABLE "ChecklistCompletion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "equipmentId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "technicianId" TEXT,
  "supervisorId" TEXT,
  "notes" TEXT,
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistCompletion_status_idx" ON "ChecklistCompletion"("status");
CREATE INDEX "ChecklistCompletion_scheduledFor_idx" ON "ChecklistCompletion"("scheduledFor");
CREATE INDEX "ChecklistCompletion_equipmentId_scheduledFor_idx"
  ON "ChecklistCompletion"("equipmentId", "scheduledFor");
CREATE INDEX "ChecklistCompletion_templateId_scheduledFor_idx"
  ON "ChecklistCompletion"("templateId", "scheduledFor");
CREATE INDEX "ChecklistCompletion_technicianId_idx"
  ON "ChecklistCompletion"("technicianId");

-- Result: per-item outcome inside a completion.
CREATE TABLE "ChecklistItemResult" (
  "id" TEXT NOT NULL,
  "completionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "result" TEXT NOT NULL DEFAULT 'pending',
  "value" TEXT,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistItemResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistItemResult_completionId_itemId_key"
  ON "ChecklistItemResult"("completionId", "itemId");
CREATE INDEX "ChecklistItemResult_result_idx" ON "ChecklistItemResult"("result");

-- Foreign keys
ALTER TABLE "MaintenanceSchedule"
  ADD CONSTRAINT "MaintenanceSchedule_checklistTemplateId_fkey"
  FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistItem"
  ADD CONSTRAINT "ChecklistItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_technicianId_fkey"
  FOREIGN KEY ("technicianId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistCompletion"
  ADD CONSTRAINT "ChecklistCompletion_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "ChecklistCompletion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistItemResult"
  ADD CONSTRAINT "ChecklistItemResult_completionId_fkey"
  FOREIGN KEY ("completionId") REFERENCES "ChecklistCompletion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistItemResult"
  ADD CONSTRAINT "ChecklistItemResult_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
