import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, reviewNote, parentEquipmentId } = body; // action: "approve" | "reject"

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

  // Approve: create the actual record — now visible to everyone
  const payload = JSON.parse(suggestion.payload);
  let createdRecordType: string | null = null;
  let createdRecordId: string | null = null;

  try {
    // Auto-create equipment if unknown and isNewEquipment
    let equipmentId = payload.equipmentId;
    if (equipmentId === "unknown" && payload.isNewEquipment !== false) {
      const nameLC = (payload.equipmentName || "").toLowerCase();
      let inferredType = "General";
      if (/truck|vehicle|forklift|loader|bobcat|van|pickup|trailer|f[- ]?250|penske/i.test(nameLC)) {
        inferredType = "Vehicle";
      } else if (/pump/.test(nameLC)) {
        inferredType = "Pump";
      } else if (/press/.test(nameLC)) {
        inferredType = "Press";
      } else if (/grinder|granulator|shredder|crusher|baler|mixer|extruder/.test(nameLC)) {
        inferredType = "Processing Equipment";
      } else if (/conveyor/.test(nameLC)) {
        inferredType = "Conveyor";
      } else if (/motor|compressor|generator|engine|drive/.test(nameLC)) {
        inferredType = "Motor/Power";
      } else if (/hvac|roof|door|dock|lighting|plumbing/.test(nameLC)) {
        inferredType = "Facility";
      }

      const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
      const tempSerial = `AUTO-${Date.now()}-${rand}`;
      const newEquipment = await prisma.equipment.create({
        data: {
          name: payload.equipmentName || "Unknown Equipment",
          type: inferredType,
          location: "TBD",
          serialNumber: tempSerial,
          status: "needs_service",
          parentId: parentEquipmentId || null,
          notes: parentEquipmentId
            ? "Auto-created as child component from AI suggestion. Please update serial number, location, and type."
            : "Auto-created from AI suggestion approval. Please update serial number, location, and type.",
        },
      });
      equipmentId = newEquipment.id;
    }

    if (suggestion.suggestionType === "create_work_order") {
      const workOrder = await prisma.workOrder.create({
        data: {
          equipmentId: equipmentId,
          createdById: session.user.id,
          title: payload.title,
          description: `[Created from AI email scan]\n\n${payload.description}`,
          priority: payload.priority || "medium",
        },
      });
      createdRecordType = "WorkOrder";
      createdRecordId = workOrder.id;
    } else if (suggestion.suggestionType === "create_maintenance_log") {
      const log = await prisma.maintenanceLog.create({
        data: {
          equipmentId: equipmentId,
          userId: session.user.id,
          description: payload.description,
          partsUsed: payload.partsUsed || null,
        },
      });
      createdRecordType = "MaintenanceLog";
      createdRecordId = log.id;
    } else if (suggestion.suggestionType === "update_equipment_status") {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: payload.newStatus },
      });
      createdRecordType = "Equipment";
      createdRecordId = equipmentId;
    } else if (suggestion.suggestionType === "create_project") {
      const project = await prisma.project.create({
        data: {
          title: payload.title,
          description: payload.description || null,
          priority: payload.priority || "medium",
          budget: payload.budget || null,
          createdById: session.user.id,
        },
      });
      createdRecordType = "Project";
      createdRecordId = project.id;
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
