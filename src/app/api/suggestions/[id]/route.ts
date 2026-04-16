import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import {
  sendImmediateNotificationToAll,
  sendDigestToAdminsAndUsers,
} from "@/lib/notifications/send-notification";
import {
  equipmentDown,
  workOrderCreated,
  projectCreated,
  equipmentStatusChanged,
  maintenanceLogged,
} from "@/lib/notifications/email-templates";

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
          notes: "Auto-created from AI suggestion approval. Please update serial number, location, and type.",
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

      // Digest notification for new work order
      const email = workOrderCreated(payload.title, payload.priority || "medium", workOrder.id);
      sendDigestToAdminsAndUsers([], {
        type: "work_order_created",
        title: email.subject,
        message: `New ${payload.priority || "medium"} priority work order: ${payload.title}`,
        relatedType: "WorkOrder",
        relatedId: workOrder.id,
      }).catch((e) => console.error("[Notification] WO created failed:", e));
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

      // Look up equipment name for notification
      const equip = await prisma.equipment.findUnique({ where: { id: equipmentId } });
      if (equip) {
        const email = maintenanceLogged(equip.name, payload.description, equipmentId);
        sendDigestToAdminsAndUsers([], {
          type: "maintenance_logged",
          title: email.subject,
          message: `Maintenance logged for ${equip.name}.`,
          relatedType: "MaintenanceLog",
          relatedId: log.id,
        }).catch((e) => console.error("[Notification] Maintenance log failed:", e));
      }
    } else if (suggestion.suggestionType === "update_equipment_status") {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: payload.newStatus },
      });
      createdRecordType = "Equipment";
      createdRecordId = equipmentId;

      const equip = await prisma.equipment.findUnique({ where: { id: equipmentId } });
      const eqName = equip?.name || payload.equipmentName || "Equipment";

      if (payload.newStatus === "down") {
        // IMMEDIATE alert to everyone — machine down
        const email = equipmentDown(eqName, equipmentId, payload.description);
        sendImmediateNotificationToAll({
          type: "equipment_down",
          title: email.subject,
          message: `${eqName} has been marked as DOWN.`,
          relatedType: "Equipment",
          relatedId: equipmentId,
          emailSubject: email.subject,
          emailHtml: email.html,
          smsText: email.plain,
        }).catch((e) => console.error("[Notification] Equipment down alert failed:", e));
      } else {
        // Digest for non-down status changes
        const email = equipmentStatusChanged(eqName, payload.newStatus, equipmentId);
        sendDigestToAdminsAndUsers([], {
          type: "equipment_status",
          title: email.subject,
          message: `${eqName} status changed to ${payload.newStatus}.`,
          relatedType: "Equipment",
          relatedId: equipmentId,
        }).catch((e) => console.error("[Notification] Equipment status failed:", e));
      }
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

      // Digest notification for new project
      const email = projectCreated(payload.title, project.id);
      sendDigestToAdminsAndUsers([], {
        type: "project_created",
        title: email.subject,
        message: `New project created: ${payload.title}`,
        relatedType: "Project",
        relatedId: project.id,
      }).catch((e) => console.error("[Notification] Project created failed:", e));
    } else if (suggestion.suggestionType === "create_auxiliary_equipment") {
      // Create a new equipment record linked to a parent
      let parentId = payload.parentEquipmentId || null;

      // If parent is "unknown" but name is given, try to find by name
      if (!parentId && payload.parentEquipmentName) {
        const parentMatch = await prisma.equipment.findFirst({
          where: {
            name: { contains: payload.parentEquipmentName, mode: "insensitive" },
          },
        });
        if (parentMatch) parentId = parentMatch.id;
      }

      const nameLC = (payload.equipmentName || "").toLowerCase();
      let inferredType = "Component";
      if (/pump/.test(nameLC)) inferredType = "Pump";
      else if (/motor/.test(nameLC)) inferredType = "Motor/Power";
      else if (/charger|battery/.test(nameLC)) inferredType = "Electrical";
      else if (/attachment|blade|bucket/.test(nameLC)) inferredType = "Attachment";
      else if (/hose|cable|pipe/.test(nameLC)) inferredType = "Hose/Cable";

      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      const tempSerial = `AUX-${Date.now()}-${rand}`;
      const auxEquipment = await prisma.equipment.create({
        data: {
          name: payload.equipmentName || "Auxiliary Equipment",
          type: inferredType,
          location: parentId ? "See parent equipment" : "TBD",
          serialNumber: tempSerial,
          status: "operational",
          parentEquipmentId: parentId,
          notes: `Auto-created as auxiliary equipment from AI scan.${parentId ? "" : " Please link to parent equipment manually."}${payload.description ? `\n${payload.description}` : ""}`,
        },
      });
      createdRecordType = "Equipment";
      createdRecordId = auxEquipment.id;

      // Also create a work order or maintenance task if the context suggests one
      if (payload.priority && payload.priority !== "low") {
        const targetEquipmentId = parentId || auxEquipment.id;
        const wo = await prisma.workOrder.create({
          data: {
            equipmentId: targetEquipmentId,
            createdById: session.user.id,
            title: payload.title || `Service: ${payload.equipmentName}`,
            description: `[Created from AI email scan — auxiliary equipment]\n\n${payload.description || ""}`,
            priority: payload.priority || "medium",
          },
        });
        // Update the suggestion to reference the WO as well
        createdRecordType = "WorkOrder";
        createdRecordId = wo.id;

        const woEmail = workOrderCreated(wo.title, payload.priority || "medium", wo.id);
        sendDigestToAdminsAndUsers([], {
          type: "work_order_created",
          title: woEmail.subject,
          message: `New work order from auxiliary equipment: ${wo.title}`,
          relatedType: "WorkOrder",
          relatedId: wo.id,
        }).catch((e) => console.error("[Notification] Aux WO created failed:", e));
      }
    } else if (suggestion.suggestionType === "progress_existing") {
      // Add a note/update to an existing record
      const recordType = payload.existingRecordType;
      const recordId = payload.existingRecordId;
      const update = payload.suggestedUpdate || payload.description || "";

      if (recordType === "WorkOrder" && recordId) {
        const existing = await prisma.workOrder.findUnique({ where: { id: recordId } });
        if (existing) {
          await prisma.workOrder.update({
            where: { id: recordId },
            data: {
              description: `${existing.description}\n\n[AI Scan Update — ${new Date().toLocaleDateString()}]\n${update}`,
            },
          });
          createdRecordType = "WorkOrder";
          createdRecordId = recordId;
        }
      } else if (recordType === "Project" && recordId) {
        const existing = await prisma.project.findUnique({ where: { id: recordId } });
        if (existing) {
          await prisma.project.update({
            where: { id: recordId },
            data: {
              description: `${existing.description || ""}\n\n[AI Scan Update — ${new Date().toLocaleDateString()}]\n${update}`,
            },
          });
          createdRecordType = "Project";
          createdRecordId = recordId;
        }
      } else if (recordType === "MaintenanceSchedule" && recordId) {
        const existing = await prisma.maintenanceSchedule.findUnique({ where: { id: recordId } });
        if (existing) {
          await prisma.maintenanceSchedule.update({
            where: { id: recordId },
            data: {
              description: `${existing.description || ""}\n\n[AI Scan Update — ${new Date().toLocaleDateString()}]\n${update}`,
            },
          });
          createdRecordType = "MaintenanceSchedule";
          createdRecordId = recordId;
        }
      }
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
