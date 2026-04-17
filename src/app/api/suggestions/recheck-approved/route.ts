import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Re-checks every approved AI suggestion against the live DB and resets any
// suggestion whose target record no longer exists back to "pending". Useful
// when branch mishandling or manual deletion has orphaned approvals.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "operator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const approved = await prisma.aISuggestion.findMany({
    where: { status: "approved" },
    select: { id: true, createdRecordType: true, createdRecordId: true },
  });

  const orphans: string[] = [];

  for (const s of approved) {
    // No target to verify against — treat as orphan so reviewer can redo it.
    if (!s.createdRecordType || !s.createdRecordId) {
      orphans.push(s.id);
      continue;
    }

    let exists = false;
    try {
      switch (s.createdRecordType) {
        case "WorkOrder":
          exists = !!(await prisma.workOrder.findUnique({
            where: { id: s.createdRecordId },
            select: { id: true },
          }));
          break;
        case "Project":
          exists = !!(await prisma.project.findUnique({
            where: { id: s.createdRecordId },
            select: { id: true },
          }));
          break;
        case "Equipment":
          exists = !!(await prisma.equipment.findUnique({
            where: { id: s.createdRecordId },
            select: { id: true },
          }));
          break;
        case "MaintenanceSchedule":
          exists = !!(await prisma.maintenanceSchedule.findUnique({
            where: { id: s.createdRecordId },
            select: { id: true },
          }));
          break;
        case "MaintenanceLog":
          exists = !!(await prisma.maintenanceLog.findUnique({
            where: { id: s.createdRecordId },
            select: { id: true },
          }));
          break;
        default:
          // Unknown type — safer to treat as orphan than silently drop.
          exists = false;
      }
    } catch {
      exists = false;
    }

    if (!exists) orphans.push(s.id);
  }

  if (orphans.length === 0) {
    return NextResponse.json({ checked: approved.length, requeued: 0 });
  }

  await prisma.aISuggestion.updateMany({
    where: { id: { in: orphans } },
    data: {
      status: "pending",
      createdRecordType: null,
      createdRecordId: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
  });

  return NextResponse.json({ checked: approved.length, requeued: orphans.length });
}
