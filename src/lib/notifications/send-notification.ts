import { prisma } from "@/lib/prisma";
import { getActiveConnection, sendEmail } from "@/lib/m365/graph-client";

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  urgency?: "immediate" | "digest"; // default: "digest"
  relatedType?: string;
  relatedId?: string;
  emailSubject?: string;
  emailHtml?: string;
  smsText?: string;
}

/**
 * Create an in-app notification.
 * - "immediate" urgency: also sends email/SMS right away and marks emailSent = true.
 * - "digest" urgency (default): stores the notification for the next digest run.
 */
export async function sendNotification(input: NotificationInput) {
  const {
    userId, type, title, message, relatedType, relatedId,
    emailSubject, emailHtml, smsText,
    urgency = "digest",
  } = input;

  const isImmediate = urgency === "immediate";

  // 1. Create in-app notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      urgency,
      emailSent: isImmediate, // immediate emails are sent now; digest waits
      relatedType: relatedType || null,
      relatedId: relatedId || null,
    },
  });

  // 2. Only send email/SMS immediately for "immediate" urgency
  if (!isImmediate) return notification;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return notification;

  const connection = await getActiveConnection();
  if (!connection) {
    console.warn("[Notifications] No active M365 connection — in-app only");
    return notification;
  }

  // 3. Send email if enabled
  if (user.notifyEmail && user.email && emailHtml) {
    try {
      await sendEmail(connection.id, user.email, emailSubject || title, emailHtml);
    } catch (e) {
      console.error("[Notifications] Email send failed:", e);
    }
  }

  // 4. Send SMS via carrier gateway if enabled
  if (user.notifySMS && user.phone && user.carrier && smsText) {
    const smsAddr = `${user.phone}@${user.carrier}`;
    try {
      await sendEmail(connection.id, smsAddr, "", `<p>${smsText.slice(0, 160)}</p>`);
    } catch (e) {
      console.error("[Notifications] SMS send failed:", e);
    }
  }

  return notification;
}

/**
 * Send a digest-urgency notification to all admin users.
 * These will be batched into summary emails at 5am, 12pm, and 5pm.
 */
export async function sendDigestNotificationToAdmins(
  input: Omit<NotificationInput, "userId" | "urgency">
) {
  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  const results = [];
  for (const admin of admins) {
    results.push(
      await sendNotification({ ...input, userId: admin.id, urgency: "digest" })
    );
  }
  return results;
}

/**
 * Send an immediate notification to ALL users (admins + operators).
 * Used for critical events like equipment going down.
 */
export async function sendImmediateNotificationToAll(
  input: Omit<NotificationInput, "userId" | "urgency">
) {
  const allUsers = await prisma.user.findMany();
  const results = [];
  for (const user of allUsers) {
    results.push(
      await sendNotification({ ...input, userId: user.id, urgency: "immediate" })
    );
  }
  return results;
}

/**
 * Send a digest notification to admins + a specific set of user IDs.
 * Deduplicates so admins who are also in userIds only get one notification.
 */
export async function sendDigestToAdminsAndUsers(
  userIds: string[],
  input: Omit<NotificationInput, "userId" | "urgency">
) {
  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  const adminIds = admins.map((a: { id: string }) => a.id);
  const allIds = Array.from(new Set([...adminIds, ...userIds]));

  const results = [];
  for (const id of allIds) {
    results.push(
      await sendNotification({ ...input, userId: id, urgency: "digest" })
    );
  }
  return results;
}
