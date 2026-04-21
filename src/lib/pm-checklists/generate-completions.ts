import { prisma } from "@/lib/prisma";

// Generate today's pending ChecklistCompletion rows for each active
// MaintenanceSchedule that has a checklistTemplate and is due. Idempotent —
// uses the date (day-level) as part of the uniqueness check so re-running
// in the same day is a no-op.
export interface GenerateResult {
  scheduled: number;
  created: number;
  skipped: number;
}

export async function generateChecklistCompletionsForDate(
  targetDate: Date = new Date(),
): Promise<GenerateResult> {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

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
  };

  for (const schedule of schedules) {
    if (!schedule.checklistTemplateId || !schedule.checklistTemplate) continue;

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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
