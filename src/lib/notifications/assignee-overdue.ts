import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { assignedItemsOverdue } from "@/lib/notifications/email-templates";

/**
 * For a single assignee, collect every overdue WorkOrder / MaintenanceSchedule
 * / Project where they are primary or secondary, then emit a per-user
 * notification + email summarizing all three types.
 *
 * Dedup rules:
 *  - Skip if the user already received an "assignee_overdue" notification in
 *    the last 24 hours (prevents re-notifying when multiple overdue crons
 *    run in sequence or a single cron is retried).
 *  - Skip admin users: they already receive the global admin digest from the
 *    existing overdue cron, so we pick one path, not both.
 *  - Primary+secondary on the same record collapses to a single row (the
 *    primary role wins).
 *
 * Returns true iff a new notification was created.
 */
export async function sendAssigneeOverdueDigest(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "admin") return false;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: {
      userId,
      type: "assignee_overdue",
      createdAt: { gte: oneDayAgo },
    },
  });
  if (recent) return false;

  const now = new Date();

  const [workOrders, schedules, projects] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        dueDate: { lte: now },
        status: { in: ["open", "in_progress"] },
        OR: [{ assignedToId: userId }, { secondaryAssignedToId: userId }],
      },
      include: { equipment: { select: { name: true } } },
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        nextDue: { lte: now },
        OR: [{ assignedToId: userId }, { secondaryAssignedToId: userId }],
      },
      include: { equipment: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: {
        dueDate: { lte: now },
        status: { in: ["planning", "in_progress", "on_hold"] },
        OR: [{ projectLeadId: userId }, { secondaryLeadId: userId }],
      },
    }),
  ]);

  const total = workOrders.length + schedules.length + projects.length;
  if (total === 0) return false;

  const woRows = workOrders.map((o) => ({
    id: o.id,
    title: o.title,
    equipmentName: o.equipment.name,
    dueDate: new Date(o.dueDate!).toLocaleDateString(),
    role: (o.assignedToId === userId ? "primary" : "secondary") as "primary" | "secondary",
  }));
  const schedRows = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    equipmentName: s.equipment.name,
    role: (s.assignedToId === userId ? "primary" : "secondary") as "primary" | "secondary",
  }));
  const projRows = projects.map((p) => ({
    id: p.id,
    title: p.title,
    dueDate: p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "—",
    role: (p.projectLeadId === userId ? "lead" : "secondary") as "lead" | "secondary",
  }));

  const email = assignedItemsOverdue(user.name, woRows, schedRows, projRows);

  await sendNotification({
    userId,
    type: "assignee_overdue",
    urgency: "immediate",
    title: email.subject,
    message: `You have ${total} overdue item${total !== 1 ? "s" : ""} assigned to you.`,
    emailSubject: email.subject,
    emailHtml: email.html,
    smsText: email.plain,
  });

  return true;
}

/**
 * Collect distinct (non-admin) user ids who are primary OR secondary on at
 * least one of the supplied records, then fire a per-user overdue digest
 * for each. Deduped across roles automatically.
 */
export async function notifyAssigneesForOverdueRecords(
  records: Array<{ assigneeIds: Array<string | null | undefined> }>
): Promise<{ notified: number }> {
  const ids = new Set<string>();
  for (const r of records) {
    for (const id of r.assigneeIds) {
      if (id) ids.add(id);
    }
  }

  let notified = 0;
  for (const id of ids) {
    try {
      const sent = await sendAssigneeOverdueDigest(id);
      if (sent) notified++;
    } catch (e) {
      console.error(`[AssigneeOverdue] failed for ${id}:`, e);
    }
  }
  return { notified };
}
