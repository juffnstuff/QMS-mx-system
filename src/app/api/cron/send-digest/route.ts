import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveConnection, sendEmail } from "@/lib/m365/graph-client";
import { statusDigest } from "@/lib/notifications/email-templates";

/**
 * Cron endpoint: send status digest emails.
 * Schedule this to run at 5:00 AM, 12:00 PM, and 5:00 PM (Eastern).
 *
 * Collects all digest-urgency notifications that haven't been emailed yet,
 * groups them by user, builds a summary email for each user, and sends it.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all unsent digest notifications
  const pendingNotifications = await prisma.notification.findMany({
    where: {
      urgency: "digest",
      emailSent: false,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, notifyEmail: true, notifySMS: true, phone: true, carrier: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (pendingNotifications.length === 0) {
    return NextResponse.json({ message: "No pending digest notifications", emailsSent: 0 });
  }

  // Group notifications by user
  type PendingNotification = (typeof pendingNotifications)[number];
  const byUser = new Map<string, PendingNotification[]>();
  for (const n of pendingNotifications) {
    const list = byUser.get(n.userId) || [];
    list.push(n);
    byUser.set(n.userId, list);
  }

  // Get M365 connection for sending emails
  const connection = await getActiveConnection();
  if (!connection) {
    console.warn("[Digest] No active M365 connection — marking notifications but cannot email");
    // Still mark them as sent so they don't pile up
    await prisma.notification.updateMany({
      where: {
        id: { in: pendingNotifications.map((n: PendingNotification) => n.id) },
      },
      data: { emailSent: true },
    });
    return NextResponse.json({
      message: "No M365 connection — notifications marked but no emails sent",
      emailsSent: 0,
      notificationsProcessed: pendingNotifications.length,
    });
  }

  let emailsSent = 0;
  let smsSent = 0;
  const errors: string[] = [];

  for (const [, notifications] of byUser) {
    const user = notifications[0].user;
    if (!user) continue;

    const notificationIds = notifications.map((n: PendingNotification) => n.id);

    // Build digest items
    const items = notifications.map((n: PendingNotification) => ({
      type: n.type,
      title: n.title,
      message: n.message,
      relatedType: n.relatedType,
      relatedId: n.relatedId,
    }));

    const digest = statusDigest(items, user.name);

    // Send email digest if user has email enabled
    if (digest && user.notifyEmail && user.email) {
      try {
        await sendEmail(connection.id, user.email, digest.subject, digest.html);
        emailsSent++;
      } catch (e) {
        const msg = `Email to ${user.email} failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Digest]", msg);
        errors.push(msg);
      }
    }

    // Send SMS summary if user has SMS enabled
    if (digest && user.notifySMS && user.phone && user.carrier) {
      const smsAddr = `${user.phone}@${user.carrier}`;
      const smsText = `QMS: ${notifications.length} update${notifications.length !== 1 ? "s" : ""} — ${digest.plain.slice(0, 120)}`;
      try {
        await sendEmail(connection.id, smsAddr, "", `<p>${smsText.slice(0, 160)}</p>`);
        smsSent++;
      } catch (e) {
        console.error("[Digest] SMS failed:", e);
      }
    }

    // Mark all as sent regardless (prevent re-sending)
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { emailSent: true },
    });
  }

  return NextResponse.json({
    message: "Digest sent",
    usersProcessed: byUser.size,
    notificationsProcessed: pendingNotifications.length,
    emailsSent,
    smsSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
