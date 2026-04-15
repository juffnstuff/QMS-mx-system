import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { equipmentId, title, description, frequency, nextDue, sourceWorkOrderId, assignedToId, secondaryAssignedToId } = body;

    if (!equipmentId || !title || !frequency || !nextDue) {
      return NextResponse.json(
        { error: "Equipment, title, frequency, and next due date are required" },
        { status: 400 }
      );
    }

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        equipmentId,
        title,
        description: description || null,
        frequency,
        nextDue: new Date(nextDue),
        sourceWorkOrderId: sourceWorkOrderId || null,
        assignedToId: assignedToId || null,
        secondaryAssignedToId: secondaryAssignedToId || null,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
