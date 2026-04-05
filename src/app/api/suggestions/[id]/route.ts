import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, reviewNote } = body; // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const suggestion = await prisma.aISuggestion.findUnique({
    where: { id },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Suggestion already reviewed" }, { status: 400 });
  }

  if (action === "reject") {
    const updated = await prisma.aISuggestion.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    });
    return NextResponse.json(updated);
  }

  // Approve: create the actual record
  const payload = JSON.parse(suggestion.payload);
  let createdRecordType: string | null = null;
  let createdRecordId: string | null = null;

  try {
    if (suggestion.suggestionType === "create_work_order") {
      const workOrder = await prisma.workOrder.create({
        data: {
          equipmentId: payload.equipmentId,
          createdById: session.user.id!,
          title: payload.title,
          description: payload.description,
          priority: payload.priority || "medium",
        },
      });
      createdRecordType = "WorkOrder";
      createdRecordId = workOrder.id;
    } else if (suggestion.suggestionType === "create_maintenance_log") {
      const log = await prisma.maintenanceLog.create({
        data: {
          equipmentId: payload.equipmentId,
          userId: session.user.id!,
          description: payload.description,
          partsUsed: payload.partsUsed || null,
        },
      });
      createdRecordType = "MaintenanceLog";
      createdRecordId = log.id;
    } else if (suggestion.suggestionType === "update_equipment_status") {
      await prisma.equipment.update({
        where: { id: payload.equipmentId },
        data: { status: payload.newStatus },
      });
      createdRecordType = "Equipment";
      createdRecordId = payload.equipmentId;
    }

    const updated = await prisma.aISuggestion.update({
      where: { id },
      data: {
        status: "approved",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
        createdRecordType,
        createdRecordId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Suggestion Approve] Error creating record:", error);
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}
