import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveConnection, sendEmail } from "@/lib/m365/graph-client";
import { statusDigest } from "@/lib/notifications/email-templates";

const BASE_URL =
  process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Map a relatedType to the URL path for the item.
 */
function linkFor(relatedType: string | null, relatedId: string | null): string {
  if (!relatedType || !relatedId) return BASE_URL;
  switch (relatedType) {
    case "WorkOrder":
      return `${BASE_URL}/work-orders/${relatedId}`;
    case "Equipment":
      return `${BASE_URL}/equipment/${relatedId}`;
    case "MaintenanceSchedule":
      return `${BASE_URL}/schedules/${relatedId}`;
    case "Project":
      return `${BASE_URL}/projects/${relatedId}`;
    case "AISuggestion":
      return `${BASE_URL}/settings/m365/suggestions`;
    default:
      return BASE_URL;
  }
}

function slotLabel(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 11) return "Morning";
  if (h < 15) return "Midday";
  return "Evening";
}

/**
 * Cron endpoint: gather unsent digest notifications, group by user, email
 * each user a single summary table, mark emailSent=true. Scheduled 5am,
 * 12pm, 5pm via vercel.json.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.notification.findMany({
    where: { urgency: "digest", emailSent: false },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json({ message: "No pending digest notifications", sent: 0 });
  }

  const connection = await getActiveConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "No active M365 connection — cannot send digest" },
      { status: 500 }
    );
  }

  // Group pending notifications by user
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    if (!n.user?.email || !n.user.notifyEmail) continue;
    const arr = byUser.get(n.userId) ?? [];
    arr.push(n);
    byUser.set(n.userId, arr);
  }

  const label = slotLabel();
  let usersEmailed = 0;
  let notificationsFlushed = 0;
  const errors: string[] = [];

  for (const [userId, notifications] of byUser) {
    const user = notifications[0].user!;
    const rows = notifications.map((n) => ({
      title: n.title,
      type: n.type,
      message: n.message,
      link: linkFor(n.relatedType, n.relatedId),
      createdAt: n.createdAt,
    }));

    const email = statusDigest(rows, label);
    try {
      await sendEmail(connection.id, user.email, email.subject, email.html);
      await prisma.notification.updateMany({
        where: { id: { in: notifications.map((n) => n.id) } },
        data: { emailSent: true },
      });
      usersEmailed++;
      notificationsFlushed += notifications.length;
    } catch (err) {
      console.error(`[Digest] Failed for user ${userId}:`, err);
      errors.push(`user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Mark SMS-only or no-email notifications as sent so they don't pile up
  const unemailable = pending.filter((n) => !n.user?.email || !n.user.notifyEmail);
  if (unemailable.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: unemailable.map((n) => n.id) } },
      data: { emailSent: true },
    });
  }

  return NextResponse.json({
    message: "Digest sent",
    slot: label,
    usersEmailed,
    notificationsFlushed,
    skipped: unemailable.length,
    errors,
  });
}
