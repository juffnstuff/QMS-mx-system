import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logStatusChange, type StatusEntityType } from "@/lib/status-log";

const VALID_BOARD_STATUSES = ["backlog", "in_progress", "needs_parts", "scheduled", "done"];
const VALID_ENTITY_TYPES = ["workOrder", "nonConformance", "capa", "project", "maintenanceSchedule"] as const;

type EntityType = (typeof VALID_ENTITY_TYPES)[number];

// Map board column → entity native status (where the mapping is unambiguous)
const BOARD_TO_NATIVE_STATUS: Record<EntityType, Record<string, string | null>> = {
  workOrder: {
    backlog: "open",
    in_progress: "in_progress",
    needs_parts: null, // no native equivalent, keep current
    scheduled: null,
    done: "completed",
  },
  nonConformance: {
    backlog: "open",
    in_progress: "under_review",
    needs_parts: null,
    scheduled: "dispositioned",
    done: "closed",
  },
  capa: {
    backlog: "open",
    in_progress: "in_progress",
    needs_parts: null,
    scheduled: "pending_verification",
    done: "closed",
  },
  project: {
    backlog: "planning",
    in_progress: "in_progress",
    needs_parts: "on_hold",
    scheduled: null,
    done: "completed",
  },
  maintenanceSchedule: {
    backlog: null,
    in_progress: null,
    needs_parts: null,
    scheduled: null,
    done: null, // maintenance schedules don't have a native status field
  },
};

// Advance a schedule's nextDue based on its frequency
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
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { entityType, entityId, boardStatus, completionNotes, partsUsed } = body as {
    entityType?: string;
    entityId?: string;
    boardStatus?: string;
    completionNotes?: string;
    partsUsed?: string;
  };

  if (!entityType || !entityId || !boardStatus) {
    return NextResponse.json(
      { error: "entityType, entityId, and boardStatus are required" },
      { status: 400 }
    );
  }

  if (!VALID_BOARD_STATUSES.includes(boardStatus)) {
    return NextResponse.json(
      { error: `Invalid boardStatus. Must be one of: ${VALID_BOARD_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
    return NextResponse.json(
      { error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { boardStatus };

  // Also update the native status if there's an unambiguous mapping
  const nativeStatus = BOARD_TO_NATIVE_STATUS[entityType as EntityType][boardStatus];
  if (nativeStatus) {
    updateData.status = nativeStatus;
    // Set completedAt for work orders and projects when moved to done
    if (boardStatus === "done" && (entityType === "workOrder" || entityType === "project")) {
      updateData.completedAt = new Date();
    }
  }

  // Capture prior boardStatus / status so we can log the change after the
  // update succeeds. Each entity stores boardStatus; only maintenanceSchedule
  // has no native status field.
  type PriorValues = { boardStatus: string; status?: string | null };
  let prior: PriorValues | null = null;
  try {
    switch (entityType as EntityType) {
      case "workOrder":
        prior = await prisma.workOrder.findUnique({
          where: { id: entityId },
          select: { boardStatus: true, status: true },
        });
        break;
      case "maintenanceSchedule":
        prior = await prisma.maintenanceSchedule.findUnique({
          where: { id: entityId },
          select: { boardStatus: true },
        });
        break;
      case "nonConformance":
        prior = await prisma.nonConformance.findUnique({
          where: { id: entityId },
          select: { boardStatus: true, status: true },
        });
        break;
      case "capa":
        prior = await prisma.cAPA.findUnique({
          where: { id: entityId },
          select: { boardStatus: true, status: true },
        });
        break;
      case "project":
        prior = await prisma.project.findUnique({
          where: { id: entityId },
          select: { boardStatus: true, status: true },
        });
        break;
    }
  } catch {
    prior = null;
  }

  try {
    const now = new Date();
    let result;
    let maintenanceLogId: string | null = null;

    switch (entityType as EntityType) {
      case "workOrder": {
        // Read equipment + title before update so we can build a log entry on done
        const existing = boardStatus === "done"
          ? await prisma.workOrder.findUnique({
              where: { id: entityId },
              select: { equipmentId: true, title: true },
            })
          : null;

        result = await prisma.workOrder.update({
          where: { id: entityId },
          data: updateData,
        });

        if (boardStatus === "done" && existing) {
          const log = await prisma.maintenanceLog.create({
            data: {
              equipmentId: existing.equipmentId,
              userId: session.user.id,
              description: completionNotes
                ? `${existing.title} — ${completionNotes}`
                : existing.title,
              partsUsed: partsUsed || null,
              performedAt: now,
            },
          });
          maintenanceLogId = log.id;
        }
        break;
      }
      case "maintenanceSchedule": {
        if (boardStatus === "done") {
          const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id: entityId },
            select: { equipmentId: true, title: true, frequency: true },
          });
          if (!schedule) throw new Error("Schedule not found");

          const newNextDue = advanceNextDue(now, schedule.frequency);
          const [log, updatedSchedule] = await prisma.$transaction([
            prisma.maintenanceLog.create({
              data: {
                equipmentId: schedule.equipmentId,
                userId: session.user.id,
                description: completionNotes
                  ? `${schedule.title} — ${completionNotes}`
                  : schedule.title,
                partsUsed: partsUsed || null,
                performedAt: now,
              },
            }),
            // Advance the schedule's nextDue and reset the board so the next cycle appears
            prisma.maintenanceSchedule.update({
              where: { id: entityId },
              data: {
                lastDone: now,
                nextDue: newNextDue,
                boardStatus: "scheduled",
              },
            }),
          ]);
          result = updatedSchedule;
          maintenanceLogId = log.id;
        } else {
          result = await prisma.maintenanceSchedule.update({
            where: { id: entityId },
            data: { boardStatus },
          });
        }
        break;
      }
      case "nonConformance":
        result = await prisma.nonConformance.update({
          where: { id: entityId },
          data: updateData,
        });
        break;
      case "capa":
        result = await prisma.cAPA.update({
          where: { id: entityId },
          data: updateData,
        });
        break;
      case "project":
        result = await prisma.project.update({
          where: { id: entityId },
          data: updateData,
        });
        break;
    }

    // Audit the board move. For maintenanceSchedule the native status
    // doesn't exist, so we log boardStatus. For the rest, log status when
    // we actually cascaded a native-status change; otherwise log boardStatus.
    const changedBy = session.user.id;
    const priorBoard = prior?.boardStatus ?? null;
    const priorStatus = prior?.status ?? null;
    if (nativeStatus && priorStatus !== nativeStatus) {
      await logStatusChange({
        entityType: entityType as StatusEntityType,
        entityId,
        field: "status",
        fromValue: priorStatus,
        toValue: nativeStatus,
        changedById: changedBy,
        note: `via kanban → ${boardStatus}`,
      });
    } else if (priorBoard !== boardStatus) {
      await logStatusChange({
        entityType: entityType as StatusEntityType,
        entityId,
        field: "boardStatus",
        fromValue: priorBoard,
        toValue: boardStatus,
        changedById: changedBy,
      });
    }

    return NextResponse.json({ ...result, maintenanceLogId });
  } catch (error) {
    console.error("[Kanban PATCH] Error:", error);
    return NextResponse.json({ error: "Record not found or update failed" }, { status: 404 });
  }
}
