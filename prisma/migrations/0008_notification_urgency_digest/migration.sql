-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "urgency" TEXT NOT NULL DEFAULT 'digest',
ADD COLUMN "emailSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Notification_urgency_emailSent_idx" ON "Notification"("urgency", "emailSent");
