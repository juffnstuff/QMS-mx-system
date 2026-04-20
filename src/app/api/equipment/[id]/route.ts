import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendImmediateNotificationToAll,
  sendDigestNotificationToAdmins,
} from "@/lib/notifications/send-notification";
import {
  equipmentDown,
  equipmentStatusChanged,
} from "@/lib/notifications/email-templates";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      name, type, location, serialNumber, status, criticality,
      equipmentClass, groupName, parentId,
      assignedTechnicianId, secondaryTechnicianId, notes,
    } = body;

    // Required fields are only validated when the caller is *changing* them.
    // Partial updates (e.g. just assigning a technician) leave them undefined
    // so the existing values stay in place.
    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (type !== undefined && !type) {
      return NextResponse.json({ error: "Type cannot be empty" }, { status: 400 });
    }
    if (location !== undefined && !location) {
      return NextResponse.json({ error: "Location cannot be empty" }, { status: 400 });
    }
    if (serialNumber !== undefined && !serialNumber) {
      return NextResponse.json({ error: "Serial number cannot be empty" }, { status: 400 });
    }

    if (serialNumber !== undefined) {
      const duplicate = await prisma.equipment.findFirst({
        where: { serialNumber, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Another equipment with this serial number already exists" },
          { status: 400 }
        );
      }
    }

    const prior = await prisma.equipment.findUnique({ where: { id } });

    // Build the update payload so unset keys are skipped rather than nulled.
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (location !== undefined) data.location = location;
    if (serialNumber !== undefined) data.serialNumber = serialNumber;
    if (status !== undefined) data.status = status;
    if (criticality !== undefined) data.criticality = criticality || "C";
    if (equipmentClass !== undefined) data.equipmentClass = equipmentClass || null;
    if (groupName !== undefined) data.groupName = groupName || null;
    if (parentId !== undefined) data.parentId = parentId || null;
    if (assignedTechnicianId !== undefined) data.assignedTechnicianId = assignedTechnicianId || null;
    if (secondaryTechnicianId !== undefined) data.secondaryTechnicianId = secondaryTechnicianId || null;
    if (notes !== undefined) data.notes = notes;

    const equipment = await prisma.equipment.update({
      where: { id },
      data,
    });

    // Status transitions: "down" fires an immediate org-wide alert. All other
    // status changes go into the digest.
    if (prior && status && status !== prior.status) {
      if (status === "down") {
        const email = equipmentDown(equipment.name, equipment.location, equipment.notes, equipment.id);
        sendImmediateNotificationToAll({
          type: "equipment_down",
          title: email.subject,
          message: `${equipment.name} at ${equipment.location} is DOWN`,
          relatedType: "Equipment",
          relatedId: equipment.id,
          emailSubject: email.subject,
          emailHtml: email.html,
          smsText: email.plain,
        }).catch((e) => console.error("[Notification] equipment_down failed:", e));
      } else {
        const email = equipmentStatusChanged(equipment.name, prior.status, status, equipment.id);
        sendDigestNotificationToAdmins({
          type: "equipment_status_changed",
          title: email.subject,
          message: `${equipment.name}: ${prior.status} → ${status}`,
          relatedType: "Equipment",
          relatedId: equipment.id,
          emailSubject: email.subject,
          emailHtml: email.html,
          smsText: email.plain,
        }).catch((e) => console.error("[Notification] equipment_status_changed failed:", e));
      }
    }

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Failed to update equipment:", error);
    return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.equipment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete equipment:", error);
    return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 });
  }
}
