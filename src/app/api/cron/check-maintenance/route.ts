import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestNotificationToAdmins } from "@/lib/notifications/send-notification";

/**
 * Cron endpoint: check for overdue maintenance schedules and create digest notifications.
 * Notifications will be included in the next status digest email (5am, 12pm, or 5pm).
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

  // Dedup: check if we already created a maintenance_due notification in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentNotification = await prisma.notification.findFirst({
    where: {
      type: "maintenance_due",
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentNotification) {
    return NextResponse.json({
      message: "Already notified within 24h",
      overdueCount: overdueSchedules.length,
      notified: 0,
    });
  }

  const scheduleList = overdueSchedules
    .map((s: { title: string; equipment: { name: string } }) => `${s.title} (${s.equipment.name})`)
    .join(", ");

  // Create digest notifications for admins — will be emailed in next digest run
  await sendDigestNotificationToAdmins({
    type: "maintenance_due",
    title: `${overdueSchedules.length} Maintenance Task${overdueSchedules.length !== 1 ? "s" : ""} Due/Overdue`,
    message: `Overdue: ${scheduleList}`,
    relatedType: "MaintenanceSchedule",
  });

  return NextResponse.json({
    message: "Digest notifications created",
    overdueCount: overdueSchedules.length,
    notified: true,
  });
}
