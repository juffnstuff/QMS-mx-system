-- AlterTable: Add sharePointDocId to AISuggestion
ALTER TABLE "AISuggestion" ADD COLUMN "sharePointDocId" TEXT;

-- AlterTable: Add deltaLink and lastPolledAt to M365Connection for per-user delta tracking
ALTER TABLE "M365Connection" ADD COLUMN "deltaLink" TEXT;
ALTER TABLE "M365Connection" ADD COLUMN "lastPolledAt" TIMESTAMP(3);

-- AlterTable: Add scannedByUserId to ProcessedMessage
ALTER TABLE "ProcessedMessage" ADD COLUMN "scannedByUserId" TEXT;

-- CreateTable
CREATE TABLE "M365SharePointSite" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "M365SharePointSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePointDocument" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "aiAnalysis" TEXT,
    "actionTaken" TEXT NOT NULL DEFAULT 'none',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharePointDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "M365SharePointSite_siteId_key" ON "M365SharePointSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointDocument_externalId_key" ON "SharePointDocument"("externalId");
