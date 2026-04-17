import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestNotificationToAdmins } from "@/lib/notifications/send-notification";
import { notifyAssigneesForOverdueRecords } from "@/lib/notifications/assignee-overdue";
import { maintenanceDue } from "@/lib/notifications/email-templates";

/**
 * Cron endpoint: check for overdue maintenance schedules and notify admins.
 * Call via Railway cron, Vercel cron, or external scheduler.
 * Secured by CRON_SECRET env var or admin auth.
 */
export async function GET(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find overdue active schedules
  const overdueSchedules = await prisma.maintenanceSchedule.findMany({
    where: {
      nextDue: { lte: new Date() },
    },
    include: {
      equipment: { select: { name: true } },
    },
  });

  if (overdueSchedules.length === 0) {
    return NextResponse.json({ message: "No overdue schedules", notified: 0 });
  }

  // Dedup: check if we already sent a maintenance_due notification in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentNotification = await prisma.notification.findFirst({
    where: {
      type: "maintenance_due",
      createdAt: { gte: oneDayAgo },
    },
  });

  let adminNotified = false;
  if (!recentNotification) {
    // Send notification to all admins
    const scheduleInfo = overdueSchedules.map((s) => ({
      title: s.title,
      equipmentName: s.equipment.name,
    }));

    const email = maintenanceDue(scheduleInfo);
    await sendDigestNotificationToAdmins({
      type: "maintenance_due",
      title: email.subject,
      message: `${overdueSchedules.length} maintenance task${overdueSchedules.length !== 1 ? "s are" : " is"} overdue.`,
      relatedType: "MaintenanceSchedule",
      emailSubject: email.subject,
      emailHtml: email.html,
      smsText: email.plain,
    });
    adminNotified = true;
  }

  // Per-assignee digest (primary + secondary). Non-admins only; the helper
  // dedupes across the three overdue crons so admins already covered by the
  // digest above aren't double-emailed.
  const assigneeResult = await notifyAssigneesForOverdueRecords(
    overdueSchedules.map((s) => ({
      assigneeIds: [s.assignedToId, s.secondaryAssignedToId],
    }))
  );

  return NextResponse.json({
    message: "Notifications processed",
    overdueCount: overdueSchedules.length,
    adminNotified,
    assigneesNotified: assigneeResult.notified,
  });
}
