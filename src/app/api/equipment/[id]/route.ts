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
    const { name, type, location, serialNumber, status, criticality, equipmentClass, groupName, parentId, assignedTechnicianId, secondaryTechnicianId, notes } = body;

    if (!name || !type || !location || !serialNumber) {
      return NextResponse.json(
        { error: "Name, type, location, and serial number are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.equipment.findFirst({
      where: { serialNumber, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Another equipment with this serial number already exists" },
        { status: 400 }
      );
    }

    const prior = await prisma.equipment.findUnique({ where: { id } });

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        name, type, location, serialNumber, status,
        criticality: criticality || "C",
        equipmentClass: equipmentClass || null,
        groupName: groupName || null,
        parentId: parentId || null,
        assignedTechnicianId: assignedTechnicianId || null,
        secondaryTechnicianId: secondaryTechnicianId || null,
        notes,
      },
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
