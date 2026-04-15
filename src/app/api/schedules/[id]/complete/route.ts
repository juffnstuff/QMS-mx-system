import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Calculate the next due date based on frequency
function advanceNextDue(from: Date, frequency: string): Date {
  const next = new Date(from);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "annual":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // fallback to monthly
  }
  return next;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { notes, partsUsed } = body as { notes?: string; partsUsed?: string };

  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { equipment: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const now = new Date();
  const newNextDue = advanceNextDue(now, schedule.frequency);

  // Run both operations in a transaction
  const [maintenanceLog, updatedSchedule] = await prisma.$transaction([
    // 1. Create a maintenance log entry
    prisma.maintenanceLog.create({
      data: {
        equipmentId: schedule.equipmentId,
        userId: session.user.id,
        description: `${schedule.title}${notes ? ` — ${notes}` : ""}`,
        partsUsed: partsUsed || null,
        performedAt: now,
      },
    }),
    // 2. Advance the schedule's nextDue and set lastDone
    prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        lastDone: now,
        nextDue: newNextDue,
        boardStatus: "scheduled", // reset board status for the next cycle
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    maintenanceLogId: maintenanceLog.id,
    previousDue: schedule.nextDue,
    newNextDue: updatedSchedule.nextDue,
    lastDone: updatedSchedule.lastDone,
  });
}
