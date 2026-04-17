-- Add urgency-based routing and digest tracking to notifications

ALTER TABLE "Notification" ADD COLUMN "urgency" TEXT NOT NULL DEFAULT 'digest';
ALTER TABLE "Notification" ADD COLUMN "emailSent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Notification_urgency_emailSent_idx" ON "Notification"("urgency", "emailSent");
