-- AlterTable: Add sharePointDocId to AISuggestion
ALTER TABLE "AISuggestion" ADD COLUMN "sharePointDocId" TEXT;

-- CreateTable
CREATE TABLE "M365UserMailbox" (
    "id" TEXT NOT NULL,
    "userPrincipalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deltaLink" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "M365UserMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "M365ScanConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "scanAllMailboxes" BOOLEAN NOT NULL DEFAULT true,
    "excludedMailboxes" TEXT NOT NULL DEFAULT '[]',
    "scanSharePoint" BOOLEAN NOT NULL DEFAULT false,
    "lastUserSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "M365ScanConfig_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "M365UserMailbox_userPrincipalName_key" ON "M365UserMailbox"("userPrincipalName");

-- CreateIndex
CREATE UNIQUE INDEX "M365SharePointSite_siteId_key" ON "M365SharePointSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointDocument_externalId_key" ON "SharePointDocument"("externalId");

-- Insert default scan config
INSERT INTO "M365ScanConfig" ("id", "scanAllMailboxes", "excludedMailboxes", "scanSharePoint", "updatedAt")
VALUES ('default', true, '[]', false, CURRENT_TIMESTAMP);
