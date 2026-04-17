import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type SuggestionKind = "maintenance" | "project" | "equipment" | "child_component";

function isSuggestionKind(value: unknown): value is SuggestionKind {
  return (
    value === "maintenance" ||
    value === "project" ||
    value === "equipment" ||
    value === "child_component"
  );
}

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
  const {
    action,
    reviewNote,
    parentEquipmentId,
    overrides,
    kind: kindOverride,
    proposedFields: proposedFieldsOverride,
  } = body as {
    action: "approve" | "reject";
    reviewNote?: string;
    parentEquipmentId?: string;
    overrides?: Record<string, string>;
    kind?: SuggestionKind;
    proposedFields?: Record<string, unknown>;
  };

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

  // Approve: create the actual record — now visible to everyone.
  // Reviewer edits in the UI arrive as `overrides` (legacy top-level fields)
  // and `proposedFields` (new per-kind edit payload) and take precedence over
  // AI-proposed values.
  const rawPayload = JSON.parse(suggestion.payload);
  const payload = { ...rawPayload };
  if (overrides) {
    const ALLOWED_OVERRIDE_KEYS = [
      "title",
      "description",
      "priority",
      "budget",
      "newStatus",
      "partsUsed",
      "equipmentName",
      "progressNote",
      "equipmentId",
    ];
    for (const key of ALLOWED_OVERRIDE_KEYS) {
      const val = overrides[key];
      if (typeof val === "string" && val.length > 0) {
        payload[key] = val;
      } else if (val === "") {
        // Empty string means "clear" — only honor that for nullable fields
        if (["budget", "partsUsed", "newStatus", "progressNote"].includes(key)) {
          payload[key] = null;
        }
      }
    }
  }

  // Resolve which record-kind we're creating. Reviewer can override the AI's
  // classification via the dropdown in the UI.
  const kind: SuggestionKind = isSuggestionKind(kindOverride)
    ? kindOverride
    : isSuggestionKind(suggestion.kind)
      ? (suggestion.kind as SuggestionKind)
      : "project";

  // Merge AI-proposed fields with reviewer edits. Reviewer values win.
  const aiProposed =
    (suggestion.proposedFields as Record<string, unknown> | null) ?? {};
  const mergedFields: Record<string, unknown> = {
    ...aiProposed,
    ...(proposedFieldsOverride ?? {}),
  };

  let createdRecordType: string | null = null;
  let createdRecordId: string | null = null;

  try {
    // When the reviewer supplied proposedFields, take the kind-driven path:
    // build the right record from those fields and skip the legacy branch.
    if (proposedFieldsOverride || suggestion.proposedFields) {
      const result = await createRecordForKind({
        kind,
        fields: mergedFields,
        userId: session.user.id,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      createdRecordType = result.type;
      createdRecordId = result.id;

      const updated = await prisma.aISuggestion.update({
        where: { id },
        data: {
          status: "approved",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
          kind,
          proposedFields: mergedFields as object,
          createdRecordType,
          createdRecordId,
        },
      });

      return NextResponse.json(updated);
    }

    // ----- Legacy fallback path (no proposedFields) -----
    // Auto-create equipment if unknown and isNewEquipment (skip for projects)
    let equipmentId = payload.equipmentId;
    const needsEquipment = suggestion.suggestionType !== "create_project";
    if (needsEquipment && equipmentId === "unknown" && payload.isNewEquipment !== false) {
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
    } else if (suggestion.suggestionType === "progress_existing") {
      // Append a progress note to an existing WO / Project / MaintenanceSchedule
      const note = `\n\n[AI progress update ${new Date().toISOString().slice(0, 10)}]\n${payload.progressNote || payload.description || ""}`;
      if (payload.existingRecordType === "WorkOrder" && payload.existingRecordId) {
        const existing = await prisma.workOrder.findUnique({ where: { id: payload.existingRecordId } });
        if (existing) {
          await prisma.workOrder.update({
            where: { id: payload.existingRecordId },
            data: { description: `${existing.description}${note}` },
          });
          createdRecordType = "WorkOrder";
          createdRecordId = payload.existingRecordId;
        }
      } else if (payload.existingRecordType === "Project" && payload.existingRecordId) {
        const existing = await prisma.project.findUnique({ where: { id: payload.existingRecordId } });
        if (existing) {
          await prisma.project.update({
            where: { id: payload.existingRecordId },
            data: { description: `${existing.description || ""}${note}` },
          });
          createdRecordType = "Project";
          createdRecordId = payload.existingRecordId;
        }
      } else if (payload.existingRecordType === "MaintenanceSchedule" && payload.existingRecordId) {
        const existing = await prisma.maintenanceSchedule.findUnique({ where: { id: payload.existingRecordId } });
        if (existing) {
          await prisma.maintenanceSchedule.update({
            where: { id: payload.existingRecordId },
            data: { description: `${existing.description || ""}${note}` },
          });
          createdRecordType = "MaintenanceSchedule";
          createdRecordId = payload.existingRecordId;
        }
      }
    } else if (suggestion.suggestionType === "create_auxiliary_equipment") {
      // Create a child component under an existing parent equipment.
      if (!payload.parentEquipmentId) {
        return NextResponse.json({ error: "Missing parentEquipmentId" }, { status: 400 });
      }
      const parent = await prisma.equipment.findUnique({ where: { id: payload.parentEquipmentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent equipment not found" }, { status: 400 });
      }
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      const aux = await prisma.equipment.create({
        data: {
          name: payload.equipmentName || `${parent.name} — ${payload.auxiliaryType || "Component"}`,
          type: payload.auxiliaryType || "Component",
          location: parent.location,
          serialNumber: `AUX-${Date.now()}-${rand}`,
          status: "needs_service",
          parentId: parent.id,
          notes: `Auto-created as auxiliary component of ${parent.name} from AI suggestion. Please update serial number and details.`,
        },
      });
      createdRecordType = "Equipment";
      createdRecordId = aux.id;

      if (payload.autoCreateWorkOrder) {
        await prisma.workOrder.create({
          data: {
            equipmentId: aux.id,
            createdById: session.user.id,
            title: payload.title || `Service ${aux.name}`,
            description: `[Auto-created from AI suggestion for auxiliary equipment]\n\n${payload.description || ""}`,
            priority: payload.priority || "medium",
          },
        });
      }
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

// Create the record type for the given suggestion kind using reviewer-edited
// proposedFields. Returns the created record's type + id, or an error.
async function createRecordForKind({
  kind,
  fields,
  userId,
}: {
  kind: SuggestionKind;
  fields: Record<string, unknown>;
  userId: string;
}): Promise<{ type: string; id: string } | { error: string }> {
  const str = (k: string): string | undefined => {
    const v = fields[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const strOrNull = (k: string): string | null => str(k) ?? null;

  if (kind === "project") {
    const title = str("title");
    if (!title) return { error: "Project title is required" };

    // Validate + enforce 2-level hierarchy on chosen parent.
    const parentProjectId = str("parentProjectId");
    if (parentProjectId) {
      const parent = await prisma.project.findUnique({
        where: { id: parentProjectId },
        select: { parentProjectId: true },
      });
      if (!parent) return { error: "Parent project not found" };
      if (parent.parentProjectId) {
        return { error: "Parent must be a top-level project" };
      }
    }

    const project = await prisma.project.create({
      data: {
        title,
        description: strOrNull("description"),
        priority: str("priority") ?? "medium",
        status: str("status") ?? "planning",
        phase: str("phase") ?? "concept",
        budget: strOrNull("budget"),
        keywords: strOrNull("keywords"),
        dueDate: str("dueDate") ? new Date(str("dueDate")!) : null,
        parentProjectId: parentProjectId ?? null,
        projectLeadId: strOrNull("projectLeadId"),
        secondaryLeadId: strOrNull("secondaryLeadId"),
        projectJustification: strOrNull("projectJustification"),
        designObjectives: strOrNull("designObjectives"),
        designRequirements: strOrNull("designRequirements"),
        potentialVendors: strOrNull("potentialVendors"),
        salesMarketingActions: strOrNull("salesMarketingActions"),
        engineeringActions: strOrNull("engineeringActions"),
        actualBudget: strOrNull("actualBudget"),
        plannedSchedule: strOrNull("plannedSchedule"),
        actualSchedule: strOrNull("actualSchedule"),
        isComplete: strOrNull("isComplete"),
        contingentDetails: strOrNull("contingentDetails"),
        createdById: userId,
      },
    });
    return { type: "Project", id: project.id };
  }

  if (kind === "maintenance") {
    const title = str("title");
    const equipmentId = str("equipmentId");
    if (!title) return { error: "Maintenance title is required" };
    if (!equipmentId) {
      return { error: "Select the equipment this schedule applies to" };
    }
    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment) return { error: "Equipment not found" };
    const nextDue = str("nextDue") ? new Date(str("nextDue")!) : new Date();
    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        equipmentId,
        title,
        description: strOrNull("description"),
        frequency: str("frequency") ?? "monthly",
        nextDue,
      },
    });
    return { type: "MaintenanceSchedule", id: schedule.id };
  }

  if (kind === "equipment") {
    const name = str("name");
    if (!name) return { error: "Equipment name is required" };
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const serialNumber = str("serialNumber") ?? `AUTO-${Date.now()}-${rand}`;
    const equipment = await prisma.equipment.create({
      data: {
        name,
        type: str("type") ?? "General",
        location: str("location") ?? "TBD",
        serialNumber,
        status: str("status") ?? "needs_service",
        criticality: str("criticality") ?? "C",
        equipmentClass: strOrNull("equipmentClass"),
        groupName: strOrNull("groupName"),
        parentId: strOrNull("parentEquipmentId"),
        notes: strOrNull("notes"),
      },
    });
    return { type: "Equipment", id: equipment.id };
  }

  // child_component
  const parentEquipmentId = str("parentEquipmentId");
  if (!parentEquipmentId) {
    return { error: "Parent equipment is required for child components" };
  }
  const parent = await prisma.equipment.findUnique({ where: { id: parentEquipmentId } });
  if (!parent) return { error: "Parent equipment not found" };
  const name = str("name");
  if (!name) return { error: "Component name is required" };
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  const serialNumber = str("serialNumber") ?? `AUX-${Date.now()}-${rand}`;
  const child = await prisma.equipment.create({
    data: {
      name,
      type: str("type") ?? "Component",
      location: str("location") ?? parent.location,
      serialNumber,
      status: str("status") ?? "needs_service",
      parentId: parent.id,
      notes: strOrNull("notes"),
    },
  });

  // If the reviewer wants us to also open a work order for the new component.
  if (fields["autoCreateWorkOrder"] === true) {
    await prisma.workOrder.create({
      data: {
        equipmentId: child.id,
        createdById: userId,
        title: `Service ${child.name}`,
        description: `[Auto-created with child component from AI suggestion]\n\n${str("notes") ?? ""}`,
        priority: "medium",
      },
    });
  }

  return { type: "Equipment", id: child.id };
}
