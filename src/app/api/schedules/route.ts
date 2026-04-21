import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { scheduleAssigned } from "@/lib/notifications/email-templates";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Notify primary + secondary on assignment (dedup: same user counts once,
    // and we skip the creator to avoid self-notifying).
    const assigneeRoles: Array<{ id: string; role: "primary" | "secondary" }> = [];
    if (assignedToId) assigneeRoles.push({ id: assignedToId, role: "primary" });
    if (secondaryAssignedToId && secondaryAssignedToId !== assignedToId) {
      assigneeRoles.push({ id: secondaryAssignedToId, role: "secondary" });
    }

    for (const { id, role } of assigneeRoles) {
      if (id === session.user.id) continue;
      const assignee = await prisma.user.findUnique({ where: { id } });
      if (!assignee) continue;
      const email = scheduleAssigned(title, assignee.name, schedule.id, role);
      sendNotification({
        userId: id,
        type: "schedule_assigned",
        urgency: "digest",
        title: email.subject,
        message: `You've been named the ${role === "secondary" ? "secondary assignee" : "assignee"} on maintenance schedule "${title}"`,
        relatedType: "MaintenanceSchedule",
        relatedId: schedule.id,
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      }).catch((e) => console.error("[Notification] schedule assignee failed:", e));
    }

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
