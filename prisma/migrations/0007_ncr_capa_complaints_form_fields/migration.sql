-- AlterTable: WorkOrder - add F-16 fields
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "workOrderType" TEXT NOT NULL DEFAULT 'corrective';
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "requirements" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "managerNotes" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "estimatedBudget" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "estimatedLeadTime" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "plannedStartDate" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- AlterTable: Project - add F-17 fields
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'concept';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectJustification" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "designObjectives" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "designRequirements" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "potentialVendors" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "salesMarketingActions" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "engineeringActions" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "releaseChecklist" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "actualBudget" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "plannedSchedule" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "actualSchedule" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isComplete" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contingentDetails" TEXT;

-- CreateTable: NonConformance
CREATE TABLE IF NOT EXISTS "NonConformance" (
    "id" TEXT NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partNumber" TEXT,
    "drawingNumber" TEXT,
    "drawingRevision" TEXT,
    "quantityAffected" TEXT,
    "vendor" TEXT,
    "otherInfo" TEXT,
    "ncrType" TEXT NOT NULL,
    "requirementDescription" TEXT NOT NULL,
    "nonConformanceDescription" TEXT NOT NULL,
    "disposition" TEXT,
    "immediateAction" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "ncrTagNumber" TEXT,
    "plantLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CAPA
CREATE TABLE IF NOT EXISTS "CAPA" (
    "id" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "originatorId" TEXT NOT NULL,
    "department" TEXT,
    "referenceNcrId" TEXT,
    "targetCloseDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "source" TEXT NOT NULL,
    "sourceOther" TEXT,
    "severityLevel" TEXT NOT NULL,
    "nonconformanceDescription" TEXT NOT NULL,
    "productProcessAffected" TEXT,
    "quantityScopeAffected" TEXT,
    "containmentActions" TEXT,
    "rcaMethod" TEXT,
    "rcaMethodOther" TEXT,
    "whyMan" TEXT,
    "whyMachine" TEXT,
    "whyMethod" TEXT,
    "whyMaterial" TEXT,
    "rootCauseStatement" TEXT,
    "verificationMethod" TEXT,
    "verifiedById" TEXT,
    "verificationDate" TIMESTAMP(3),
    "effectivenessOutcome" TEXT,
    "objectiveEvidence" TEXT,
    "lessonsLearned" TEXT,
    "preventiveActions" TEXT,
    "finalDisposition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAPA_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CAPAAction
CREATE TABLE IF NOT EXISTS "CAPAAction" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "actionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleParty" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAPAAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomerComplaint
CREATE TABLE IF NOT EXISTS "CustomerComplaint" (
    "id" TEXT NOT NULL,
    "complaintNumber" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerContact" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "partNumber" TEXT,
    "salesOrderNumber" TEXT,
    "invoiced" TEXT,
    "invoiceNumber" TEXT,
    "invoiceValue" TEXT,
    "drawingNumber" TEXT,
    "drawingRevision" TEXT,
    "quantityAffected" TEXT,
    "otherInfo" TEXT,
    "complaintType" TEXT NOT NULL,
    "complaintDescription" TEXT NOT NULL,
    "disposition" TEXT,
    "rmaNumber" TEXT,
    "customerFacingAction" TEXT,
    "internalAction" TEXT,
    "ncrRequired" BOOLEAN NOT NULL DEFAULT false,
    "capaRequired" BOOLEAN NOT NULL DEFAULT false,
    "affectsOtherOrders" BOOLEAN NOT NULL DEFAULT false,
    "rootCauseRequired" BOOLEAN NOT NULL DEFAULT false,
    "linkedNcrId" TEXT,
    "linkedCapaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: NonConformance
CREATE UNIQUE INDEX IF NOT EXISTS "NonConformance_ncrNumber_key" ON "NonConformance"("ncrNumber");
CREATE INDEX IF NOT EXISTS "NonConformance_status_idx" ON "NonConformance"("status");
CREATE INDEX IF NOT EXISTS "NonConformance_ncrType_idx" ON "NonConformance"("ncrType");

-- CreateIndex: CAPA
CREATE UNIQUE INDEX IF NOT EXISTS "CAPA_capaNumber_key" ON "CAPA"("capaNumber");
CREATE INDEX IF NOT EXISTS "CAPA_status_idx" ON "CAPA"("status");
CREATE INDEX IF NOT EXISTS "CAPA_severityLevel_idx" ON "CAPA"("severityLevel");

-- CreateIndex: CAPAAction
CREATE INDEX IF NOT EXISTS "CAPAAction_capaId_idx" ON "CAPAAction"("capaId");

-- CreateIndex: CustomerComplaint
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerComplaint_complaintNumber_key" ON "CustomerComplaint"("complaintNumber");
CREATE INDEX IF NOT EXISTS "CustomerComplaint_status_idx" ON "CustomerComplaint"("status");
CREATE INDEX IF NOT EXISTS "CustomerComplaint_complaintType_idx" ON "CustomerComplaint"("complaintType");

-- AddForeignKey: WorkOrder.approvedById -> User.id
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: NonConformance.submittedById -> User.id
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: NonConformance.approvedById -> User.id
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CAPA.originatorId -> User.id
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_originatorId_fkey" FOREIGN KEY ("originatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CAPA.assignedToId -> User.id
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CAPA.verifiedById -> User.id
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CAPA.referenceNcrId -> NonConformance.id
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_referenceNcrId_fkey" FOREIGN KEY ("referenceNcrId") REFERENCES "NonConformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CAPAAction.capaId -> CAPA.id
ALTER TABLE "CAPAAction" ADD CONSTRAINT "CAPAAction_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CustomerComplaint.submittedById -> User.id
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
