import { prisma } from "@/lib/prisma";
import { getActiveConnection, sendEmail } from "@/lib/m365/graph-client";

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
  emailSubject?: string;
  emailHtml?: string;
  smsText?: string;
}

/**
 * Create an in-app notification and optionally send email/SMS.
 */
export async function sendNotification(input: NotificationInput) {
  const { userId, type, title, message, relatedType, relatedId, emailSubject, emailHtml, smsText } = input;

  // 1. Create in-app notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      relatedType: relatedType || null,
      relatedId: relatedId || null,
    },
  });

  // 2. Get user preferences
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return notification;

  // 3. Get active M365 connection for sending
  const connection = await getActiveConnection();
  if (!connection) {
    console.warn("[Notifications] No active M365 connection — in-app only");
    return notification;
  }

  // 4. Send email if enabled
  if (user.notifyEmail && user.email && emailHtml) {
    try {
      await sendEmail(connection.id, user.email, emailSubject || title, emailHtml);
    } catch (e) {
      console.error("[Notifications] Email send failed:", e);
    }
  }

  // 5. Send SMS via carrier gateway if enabled
  if (user.notifySMS && user.phone && user.carrier && smsText) {
    const smsAddr = `${user.phone}@${user.carrier}`;
    try {
      // SMS via carrier gateway: short plain-text email
      await sendEmail(connection.id, smsAddr, "", `<p>${smsText.slice(0, 160)}</p>`);
    } catch (e) {
      console.error("[Notifications] SMS send failed:", e);
    }
  }

  return notification;
}

/**
 * Send a notification to all admin users.
 */
export async function sendNotificationToAdmins(
  input: Omit<NotificationInput, "userId">
) {
  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  const results = [];
  for (const admin of admins) {
    results.push(await sendNotification({ ...input, userId: admin.id }));
  }
  return results;
}
