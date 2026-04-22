import { prisma } from "@/lib/prisma";
import { startOfEasternDay } from "@/lib/pm-checklists/eastern-time";

// KPIs for the P-19 compliance board. Each KPI has a target (from the
// procedure) and an actual value computed from the database. Percentages
// are 0-100.

export interface KpiValue {
  label: string;
  target: string;
  actual: string;
  passing: boolean;
  detail?: string;
}

export interface PmComplianceBreakdown {
  equipmentClass: string | null;
  label: string;
  target: number; // percentage
  scheduled: number;
  completed: number;
  missed: number;
  superseded: number;
  percent: number | null; // null when no schedule data
}

export interface KpiReport {
  // PM compliance by equipment class over the past `windowDays` days.
  compliance: PmComplianceBreakdown[];
  // One-off tiles.
  openWorkOrders: KpiValue;
  overdueCriticalWorkOrders: KpiValue;
  overdueMaintenance: KpiValue;
  overduePmCompletions: KpiValue;
  // Window used for PM compliance calculations.
  windowDays: number;
}

const CLASS_LABELS: Record<string, { label: string; target: number }> = {
  presses: { label: "PM Compliance — Compression Molding (Class A)", target: 95 },
  extruders: { label: "PM Compliance — Extrusion (Class A)", target: 95 },
  utilities: { label: "PM Compliance — Utilities (boiler, compressors)", target: 95 },
  forklifts: { label: "PM Compliance — Forklifts", target: 100 },
  other: { label: "PM Compliance — Other equipment", target: 85 },
};

export async function computeKpis(windowDays = 30): Promise<KpiReport> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Pull completions scheduled in the window, include equipmentClass for grouping.
  const completions = await prisma.checklistCompletion.findMany({
    where: { scheduledFor: { gte: windowStart, lte: now } },
    select: {
      status: true,
      equipment: { select: { equipmentClass: true } },
    },
  });

  const byClass = new Map<
    string | null,
    { scheduled: number; completed: number; missed: number; superseded: number }
  >();
  for (const c of completions) {
    const k = c.equipment.equipmentClass ?? null;
    const bucket = byClass.get(k) ?? {
      scheduled: 0,
      completed: 0,
      missed: 0,
      superseded: 0,
    };
    bucket.scheduled += 1;
    if (c.status === "completed") bucket.completed += 1;
    else if (c.status === "superseded") bucket.superseded += 1;
    else if (c.status === "missed") bucket.missed += 1;
    byClass.set(k, bucket);
  }

  const compliance: PmComplianceBreakdown[] = [];
  const seenClasses = new Set(byClass.keys());
  // Render known classes in a stable order, then any "other" unknown buckets.
  const knownOrder = ["presses", "extruders", "utilities", "forklifts", "other"];
  for (const cls of knownOrder) {
    if (!byClass.has(cls)) continue;
    const b = byClass.get(cls)!;
    const meta = CLASS_LABELS[cls] ?? { label: cls, target: 85 };
    const effectivelyDone = b.completed + b.superseded;
    const percent = b.scheduled === 0 ? null : Math.round((effectivelyDone / b.scheduled) * 1000) / 10;
    compliance.push({
      equipmentClass: cls,
      label: meta.label,
      target: meta.target,
      scheduled: b.scheduled,
      completed: b.completed,
      missed: b.missed,
      superseded: b.superseded,
      percent,
    });
    seenClasses.delete(cls);
  }
  // Anything that didn't match a known class bucket.
  for (const cls of seenClasses) {
    const b = byClass.get(cls)!;
    const effectivelyDone = b.completed + b.superseded;
    const percent = b.scheduled === 0 ? null : Math.round((effectivelyDone / b.scheduled) * 1000) / 10;
    compliance.push({
      equipmentClass: cls,
      label: `PM Compliance — ${cls ?? "Uncategorized"}`,
      target: 85,
      scheduled: b.scheduled,
      completed: b.completed,
      missed: b.missed,
      superseded: b.superseded,
      percent,
    });
  }

  // Work orders.
  const [openWo, criticalOverdueWo, overdueSchedules, overdueCompletions] = await Promise.all([
    prisma.workOrder.count({
      where: { status: { in: ["open", "in_progress"] } },
    }),
    prisma.workOrder.count({
      where: {
        status: { in: ["open", "in_progress"] },
        priority: "critical",
        createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    }),
    prisma.maintenanceSchedule.count({
      where: { nextDue: { lt: now } },
    }),
    prisma.checklistCompletion.count({
      where: {
        status: { in: ["pending", "in_progress"] },
        scheduledFor: { lt: startOfEasternDay(now) },
      },
    }),
  ]);

  const openWorkOrders: KpiValue = {
    label: "Open Work Orders",
    target: "< 5",
    actual: String(openWo),
    passing: openWo < 5,
  };

  const overdueCriticalWorkOrders: KpiValue = {
    label: "Critical WOs overdue > 48h",
    target: "0",
    actual: String(criticalOverdueWo),
    passing: criticalOverdueWo === 0,
    detail: "Zero-tolerance per P-19",
  };

  const overdueMaintenance: KpiValue = {
    label: "Overdue Maintenance Schedules",
    target: "0",
    actual: String(overdueSchedules),
    passing: overdueSchedules === 0,
    detail: "Schedules whose nextDue has passed",
  };

  const overduePmCompletions: KpiValue = {
    label: "Overdue PM Checklists",
    target: "0",
    actual: String(overdueCompletions),
    passing: overdueCompletions === 0,
    detail: "Pending completions scheduled for a past day",
  };

  return {
    compliance,
    openWorkOrders,
    overdueCriticalWorkOrders,
    overdueMaintenance,
    overduePmCompletions,
    windowDays,
  };
}
