import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Delete MaintenanceSchedule rows that are now redundant with the PM
// Checklist system. A row is "redundant" when it has no checklistTemplateId
// AND another schedule on the same equipment DOES have a checklistTemplateId
// for the same frequency. Example: the legacy "Dake 300T — Daily inspection"
// (no template) is redundant with the DAILY_DAKE_300T checklist-backed
// schedule.
//
// Safe to run repeatedly — a second call with the same data is a no-op.
// Supports ?dryRun=true to preview without mutating.
export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  try {
    // Map equipmentId → Set<frequency> of frequencies already covered by a
    // checklist-backed schedule. Used to decide which non-checklist siblings
    // are redundant.
    const checklistBacked = await prisma.maintenanceSchedule.findMany({
      where: { checklistTemplateId: { not: null } },
      select: { equipmentId: true, frequency: true },
    });
    const covered = new Map<string, Set<string>>();
    for (const s of checklistBacked) {
      const freqs = covered.get(s.equipmentId) ?? new Set<string>();
      freqs.add(s.frequency);
      covered.set(s.equipmentId, freqs);
    }

    // Find non-checklist schedules on equipment that has at least one
    // checklist-backed sibling. Narrow with an IN on the keys of `covered`.
    const equipmentIds = [...covered.keys()];
    if (equipmentIds.length === 0) {
      return NextResponse.json({ deleted: [], wouldDelete: [], dryRun });
    }

    const candidates = await prisma.maintenanceSchedule.findMany({
      where: {
        checklistTemplateId: null,
        equipmentId: { in: equipmentIds },
      },
      select: {
        id: true,
        title: true,
        frequency: true,
        equipmentId: true,
        equipment: { select: { serialNumber: true, name: true } },
      },
    });

    const redundant = candidates.filter((c) =>
      covered.get(c.equipmentId)?.has(c.frequency),
    );

    if (dryRun || redundant.length === 0) {
      return NextResponse.json({
        dryRun,
        wouldDelete: redundant.map((r) => ({
          id: r.id,
          title: r.title,
          frequency: r.frequency,
          equipment: r.equipment,
        })),
        deleted: [],
        count: redundant.length,
      });
    }

    await prisma.maintenanceSchedule.deleteMany({
      where: { id: { in: redundant.map((r) => r.id) } },
    });

    return NextResponse.json({
      dryRun: false,
      deleted: redundant.map((r) => ({
        id: r.id,
        title: r.title,
        frequency: r.frequency,
        equipment: r.equipment,
      })),
      count: redundant.length,
    });
  } catch (err) {
    console.error("[cleanup-legacy-schedules] failed:", err);
    return NextResponse.json(
      { error: "Cleanup failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
