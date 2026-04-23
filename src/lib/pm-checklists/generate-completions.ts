import { prisma } from "@/lib/prisma";
import { startOfEasternDay, endOfEasternDay } from "./eastern-time";

// Generate today's pending ChecklistCompletion rows for each active
// MaintenanceSchedule that has a checklistTemplate and is due. Idempotent —
// uses the Eastern calendar day as the uniqueness boundary so re-running
// within the same Eastern day is a no-op.
export interface GenerateResult {
  scheduled: number;
  created: number;
  skipped: number;
  priorPendingMissed: number;
}

export async function generateChecklistCompletionsForDate(
  targetDate: Date = new Date(),
): Promise<GenerateResult> {
  const dayStart = startOfEasternDay(targetDate);
  const dayEnd = endOfEasternDay(targetDate);

  // Find schedules that are due today or earlier and have a template.
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      checklistTemplateId: { not: null },
      nextDue: { lte: dayEnd },
    },
    include: { checklistTemplate: true },
  });

  const result: GenerateResult = {
    scheduled: schedules.length,
    created: 0,
    skipped: 0,
    priorPendingMissed: 0,
  };

  for (const schedule of schedules) {
    if (!schedule.checklistTemplateId || !schedule.checklistTemplate) continue;

    // Any older pending / in_progress completion for this schedule rolls up
    // to "missed" — we only want one active checklist per schedule per day.
    // The days-since-last-completion helper on the form communicates how
    // long the equipment has gone without a full PM.
    const olderOpen = await prisma.checklistCompletion.findMany({
      where: {
        scheduleId: schedule.id,
        status: { in: ["pending", "in_progress"] },
        scheduledFor: { lt: dayStart },
      },
      select: { id: true },
    });
    if (olderOpen.length > 0) {
      await prisma.checklistCompletion.updateMany({
        where: { id: { in: olderOpen.map((c) => c.id) } },
        data: { status: "missed" },
      });
      result.priorPendingMissed += olderOpen.length;
    }

    // Skip if we've already created a completion for this schedule today.
    const existing = await prisma.checklistCompletion.findFirst({
      where: {
        scheduleId: schedule.id,
        scheduledFor: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existing) {
      result.skipped += 1;
      continue;
    }

    // Create the pending completion with empty per-item result rows (one per
    // template item). This pre-populates the form so the API can use nested
    // updates instead of creates on every checkbox toggle.
    const items = await prisma.checklistItem.findMany({
      where: { templateId: schedule.checklistTemplateId },
      select: { id: true },
    });

    await prisma.checklistCompletion.create({
      data: {
        templateId: schedule.checklistTemplateId,
        scheduleId: schedule.id,
        equipmentId: schedule.equipmentId,
        scheduledFor: dayStart,
        status: "pending",
        technicianId: schedule.assignedToId,
        results: {
          create: items.map((item) => ({
            itemId: item.id,
            result: "pending",
          })),
        },
      },
    });
    result.created += 1;
  }

  return result;
}
