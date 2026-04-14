import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { entityType, entityId, boardStatus } = body;

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

  try {
    let result;

    switch (entityType as EntityType) {
      case "workOrder":
        result = await prisma.workOrder.update({
          where: { id: entityId },
          data: updateData,
        });
        break;
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
      case "maintenanceSchedule":
        result = await prisma.maintenanceSchedule.update({
          where: { id: entityId },
          data: { boardStatus },
        });
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Kanban PATCH] Error:", error);
    return NextResponse.json({ error: "Record not found or update failed" }, { status: 404 });
  }
}
