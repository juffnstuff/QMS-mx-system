import { prisma } from "@/lib/prisma";
import { getActiveConnection, sendEmail } from "@/lib/m365/graph-client";

export type NotificationUrgency = "immediate" | "digest";

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  urgency?: NotificationUrgency; // defaults to "digest"
  relatedType?: string;
  relatedId?: string;
  emailSubject?: string;
  emailHtml?: string;
  smsText?: string;
}

type BroadcastInput = Omit<NotificationInput, "userId">;

async function deliverToUser(
  userId: string,
  input: BroadcastInput
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  const connection = await getActiveConnection();
  if (!connection) {
    console.warn("[Notifications] No active M365 connection — in-app only");
    return false;
  }

  let anySent = false;

  if (user.notifyEmail && user.email && input.emailHtml) {
    try {
      await sendEmail(
        connection.id,
        user.email,
        input.emailSubject || input.title,
        input.emailHtml
      );
      anySent = true;
    } catch (e) {
      console.error("[Notifications] Email send failed:", e);
    }
  }

  if (user.notifySMS && user.phone && user.carrier && input.smsText) {
    const smsAddr = `${user.phone}@${user.carrier}`;
    try {
      await sendEmail(connection.id, smsAddr, "", `<p>${input.smsText.slice(0, 160)}</p>`);
      anySent = true;
    } catch (e) {
      console.error("[Notifications] SMS send failed:", e);
    }
  }

  return anySent;
}

/**
 * Create an in-app notification. If urgency="immediate", send email/SMS now
 * and mark emailSent=true. If urgency="digest" (default), leave emailSent=false
 * — the send-digest cron batches these into 5am / 12pm / 5pm summary emails.
 */
export async function sendNotification(input: NotificationInput) {
  const urgency: NotificationUrgency = input.urgency || "digest";

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      urgency,
      emailSent: false,
      relatedType: input.relatedType || null,
      relatedId: input.relatedId || null,
    },
  });

  if (urgency === "immediate") {
    const sent = await deliverToUser(input.userId, input);
    if (sent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    }
  }

  return notification;
}

/**
 * Queue a digest notification for every admin. Emails go out via send-digest cron.
 */
export async function sendDigestNotificationToAdmins(input: BroadcastInput) {
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
 * Send an immediate notification to every user. Reserved for equipment-down
 * alerts and other truly urgent events.
 */
export async function sendImmediateNotificationToAll(input: BroadcastInput) {
  const users = await prisma.user.findMany();
  const results = [];
  for (const user of users) {
    results.push(
      await sendNotification({ ...input, userId: user.id, urgency: "immediate" })
    );
  }
  return results;
}

/**
 * @deprecated Use sendDigestNotificationToAdmins. Retained temporarily so
 * existing callers keep compiling while they migrate.
 */
export const sendNotificationToAdmins = sendDigestNotificationToAdmins;

/**
 * Queue a digest notification for every admin PLUS additional specific users
 * (deduped). Used when an event has specific assignees/creators who should
 * also see it in their next digest.
 */
export async function sendDigestToAdminsAndUsers(
  input: BroadcastInput,
  additionalUserIds: (string | null | undefined)[]
) {
  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  const ids = new Set<string>(admins.map((a) => a.id));
  for (const id of additionalUserIds) {
    if (id) ids.add(id);
  }
  const results = [];
  for (const userId of ids) {
    results.push(
      await sendNotification({ ...input, userId, urgency: "digest" })
    );
  }
  return results;
}
