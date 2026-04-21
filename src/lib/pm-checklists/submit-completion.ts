import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { advanceEasternNextDue } from "./eastern-time";

// Result payload the tech submits for a single item.
export interface ItemResultInput {
  itemId: string;
  result: "pass" | "fail" | "na";
  value?: string | null;
  notes?: string | null;
}

export interface SubmitInput {
  completionId: string;
  technicianId: string;
  supervisorId?: string | null;
  notes?: string | null;
  results: ItemResultInput[];
}

export interface SubmitOutcome {
  completionId: string;
  superseded: string[]; // IDs of lower-frequency completions that were superseded
  workOrdersCreated: string[]; // IDs of auto-generated WOs
}

// Submit a completed checklist. Runs the supersede + escalation side effects
// atomically: on any failure the completion is NOT marked completed.
export async function submitCompletion(input: SubmitInput): Promise<SubmitOutcome> {
  const completion = await prisma.checklistCompletion.findUnique({
    where: { id: input.completionId },
    include: {
      template: true,
      equipment: true,
      schedule: true,
      results: { include: { item: true } },
    },
  });
  if (!completion) throw new Error("Checklist completion not found");
  if (completion.status === "completed" || completion.status === "superseded") {
    throw new Error(`Cannot submit a ${completion.status} checklist`);
  }

  // Persist each per-item result. Pre-generated completions already have a
  // row per item (from the cron generator), so we update in place.
  const byItemId = new Map(input.results.map((r) => [r.itemId, r]));
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const result of completion.results) {
      const incoming = byItemId.get(result.itemId);
      if (!incoming) continue;
      await tx.checklistItemResult.update({
        where: { id: result.id },
        data: {
          result: incoming.result,
          value: incoming.value ?? null,
          notes: incoming.notes ?? null,
          completedAt: now,
        },
      });
    }

    // Mark completion as completed and link the submitter.
    await tx.checklistCompletion.update({
      where: { id: completion.id },
      data: {
        status: "completed",
        completedAt: now,
        startedAt: completion.startedAt ?? now,
        technicianId: input.technicianId,
        supervisorId: input.supervisorId ?? null,
        notes: input.notes ?? null,
      },
    });

    // Roll forward the source schedule.
    if (completion.scheduleId) {
      const nextDue = advanceNextDue(completion.template.frequency, now);
      await tx.maintenanceSchedule.update({
        where: { id: completion.scheduleId },
        data: { lastDone: now, nextDue },
      });
    }
  });

  // Run supersede + WorkOrder creation outside the main transaction — these
  // are independent side effects that shouldn't roll back the main submit.
  const superseded = await supersedeLowerFrequency(completion.id);
  const workOrdersCreated = await createEscalationWorkOrders(
    completion.id,
    input.technicianId,
  );

  return {
    completionId: completion.id,
    superseded,
    workOrdersCreated,
  };
}

// If this completion's template has supersedesCodes (e.g. weekly supersedes
// daily), mark any open completions for those templates on the same equipment
// that were scheduled today-or-earlier as superseded.
async function supersedeLowerFrequency(completionId: string): Promise<string[]> {
  const completion = await prisma.checklistCompletion.findUniqueOrThrow({
    where: { id: completionId },
    include: { template: true },
  });

  if (!completion.template.supersedesCodes) return [];
  const codes = completion.template.supersedesCodes
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) return [];

  const lowerTemplates = await prisma.checklistTemplate.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  if (lowerTemplates.length === 0) return [];

  const openLower = await prisma.checklistCompletion.findMany({
    where: {
      equipmentId: completion.equipmentId,
      templateId: { in: lowerTemplates.map((t) => t.id) },
      status: { in: ["pending", "in_progress"] },
      scheduledFor: { lte: completion.scheduledFor },
    },
    select: { id: true },
  });

  if (openLower.length === 0) return [];

  await prisma.checklistCompletion.updateMany({
    where: { id: { in: openLower.map((c) => c.id) } },
    data: {
      status: "superseded",
      supersededById: completion.id,
    },
  });

  // Also roll forward the source schedules of the superseded daily/weekly
  // completions — a completed weekly satisfies the daily for that day.
  const supersededWithSchedule = await prisma.checklistCompletion.findMany({
    where: { id: { in: openLower.map((c) => c.id) }, scheduleId: { not: null } },
    select: { scheduleId: true, templateId: true, template: { select: { frequency: true } } },
  });
  const now = new Date();
  for (const sc of supersededWithSchedule) {
    if (!sc.scheduleId) continue;
    await prisma.maintenanceSchedule.update({
      where: { id: sc.scheduleId },
      data: {
        lastDone: now,
        nextDue: advanceNextDue(sc.template.frequency, now),
      },
    });
  }

  return openLower.map((c) => c.id);
}

// Create a WorkOrder for every critical item that the tech marked "fail".
async function createEscalationWorkOrders(
  completionId: string,
  createdById: string,
): Promise<string[]> {
  const completion = await prisma.checklistCompletion.findUniqueOrThrow({
    where: { id: completionId },
    include: {
      equipment: true,
      template: true,
      results: { include: { item: true } },
    },
  });

  const failures = completion.results.filter(
    (r) => r.result === "fail" && r.item.isCritical,
  );
  if (failures.length === 0) return [];

  const created: string[] = [];
  for (const failure of failures) {
    const title = `PM escalation: ${failure.item.label} — ${completion.equipment.name}`;
    const descriptionParts = [
      `Triggered automatically from ${completion.template.name} on ${completion.equipment.name} (${completion.equipment.serialNumber}).`,
      failure.item.escalationNote
        ? `\nEscalation rule: ${failure.item.escalationNote}`
        : "",
      failure.notes ? `\nTechnician note: ${failure.notes}` : "",
      failure.value ? `\nMeasured value: ${failure.value}` : "",
      `\nChecklist completion: ${completion.id}`,
    ];

    const workOrder = await prisma.workOrder.create({
      data: {
        equipmentId: completion.equipmentId,
        createdById,
        title,
        description: descriptionParts.join(""),
        priority: "critical",
        workOrderType: "corrective",
        assignedToId: completion.equipment.assignedTechnicianId,
        secondaryAssignedToId: completion.equipment.secondaryTechnicianId,
      },
    });
    created.push(workOrder.id);

    // Notify primary + secondary (dedup + skip the submitter).
    const recipients = new Set<string>();
    if (completion.equipment.assignedTechnicianId) {
      recipients.add(completion.equipment.assignedTechnicianId);
    }
    if (completion.equipment.secondaryTechnicianId) {
      recipients.add(completion.equipment.secondaryTechnicianId);
    }
    recipients.delete(createdById);

    for (const userId of recipients) {
      sendNotification({
        userId,
        type: "checklist_critical_failure",
        urgency: "immediate",
        title: `Critical PM failure: ${completion.equipment.name}`,
        message: `${failure.item.label} failed during ${completion.template.name}. Auto-WO created.`,
        relatedType: "WorkOrder",
        relatedId: workOrder.id,
      }).catch((e) =>
        console.error("[Notification] checklist critical failure failed:", e),
      );
    }
  }

  return created;
}

function advanceNextDue(frequency: string, from: Date): Date {
  return advanceEasternNextDue(frequency, from);
}
